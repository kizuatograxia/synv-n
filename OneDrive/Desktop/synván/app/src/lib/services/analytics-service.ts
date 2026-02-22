import { prisma } from '@/lib/db/prisma'

interface SalesSummary {
  totalRevenue: number
  totalTicketsSold: number
  totalOrders: number
  averageOrderValue: number
}

interface PreviousPeriodSummary {
  totalRevenue: number
  totalTicketsSold: number
  totalOrders: number
  averageOrderValue: number
}

interface DailySales {
  date: string
  revenue: number
  ticketsSold: number
}

interface AttendeeDemographics {
  ageGroups: Record<string, number>
  ticketTypes: Record<string, number>
  paymentMethods: Record<string, number>
}

interface RealTimeStats {
  activeTicketsSold: number
  todayRevenue: number
  pendingOrders: number
  approvedOrders: number
}

export class AnalyticsService {
  static async getOrganizerSalesSummary(
    organizerId: string,
    eventId?: string,
    days?: number,
    startDate?: Date
  ): Promise<SalesSummary> {
    const where: any = {
      paymentStatus: 'APPROVED',
      event: { organizerId }
    }

    if (eventId) {
      where.eventId = eventId
    }

    if (startDate) {
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + (days || 30))
      where.createdAt = {
        gte: startDate,
        lt: endDate
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        tickets: true
      }
    })

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0)
    const totalTicketsSold = orders.reduce((sum, order) => sum + order.tickets.length, 0)
    const totalOrders = orders.length
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return {
      totalRevenue,
      totalTicketsSold,
      totalOrders,
      averageOrderValue
    }
  }

  static async getPreviousPeriodSummary(
    organizerId: string,
    eventId: string | undefined,
    days: number
  ): Promise<PreviousPeriodSummary> {
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - days)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days)

    return this.getOrganizerSalesSummary(organizerId, eventId, days, startDate)
  }

  static async getDailySales(
    organizerId: string,
    eventId?: string,
    days: number = 30
  ): Promise<DailySales[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const salesWhere: any = {
      paymentStatus: 'APPROVED',
      createdAt: { gte: startDate },
      event: { organizerId }
    }

    if (eventId) {
      salesWhere.eventId = eventId
    }

    const orders = await prisma.order.findMany({
      where: salesWhere,
      include: {
        tickets: true
      }
    })

    const salesByDate: Record<string, DailySales> = {}

    orders.forEach(order => {
      const dateKey = order.createdAt.toISOString().split('T')[0]
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          revenue: 0,
          ticketsSold: 0
        }
      }

      salesByDate[dateKey].revenue += order.totalAmount
      salesByDate[dateKey].ticketsSold += order.tickets.length
    })

    const sortedDates = Object.keys(salesByDate).sort()

    return sortedDates.map(date => salesByDate[date])
  }

  static async getAttendeeDemographics(
    organizerId: string,
    eventId?: string
  ): Promise<AttendeeDemographics> {
    const where: any = {
      event: { organizerId }
    }

    if (eventId) {
      where.eventId = eventId
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        order: true
      }
    })

    const ticketTypes: Record<string, number> = {}
    const paymentMethods: Record<string, number> = {}

    tickets.forEach(ticket => {
      const ticketType = ticket.type
      ticketTypes[ticketType] = (ticketTypes[ticketType] || 0) + 1

      const paymentMethod = ticket.order.paymentMethod
      paymentMethods[paymentMethod] = (paymentMethods[paymentMethod] || 0) + 1
    })

    return {
      ageGroups: {},
      ticketTypes,
      paymentMethods
    }
  }

  static async getRealTimeStats(
    organizerId: string,
    eventId?: string
  ): Promise<RealTimeStats> {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayWhere: any = {
      paymentStatus: 'APPROVED',
      createdAt: { gte: todayStart },
      event: { organizerId }
    }

    const pendingWhere: any = {
      paymentStatus: 'PENDING',
      event: { organizerId }
    }

    const approvedWhere: any = {
      paymentStatus: 'APPROVED',
      event: { organizerId }
    }

    if (eventId) {
      todayWhere.eventId = eventId
      pendingWhere.eventId = eventId
      approvedWhere.eventId = eventId
    }

    const today = await prisma.order.findMany({
      where: todayWhere,
      include: {
        tickets: true
      }
    })

    const pending = await prisma.order.count({
      where: pendingWhere
    })

    const approved = await prisma.order.count({
      where: approvedWhere
    })

    const activeTicketsSold = today.reduce((sum, order) => sum + order.tickets.length, 0)
    const todayRevenue = today.reduce((sum, order) => sum + order.totalAmount, 0)

    return {
      activeTicketsSold,
      todayRevenue,
      pendingOrders: pending,
      approvedOrders: approved
    }
  }

  static async getTopSellingEvents(
    organizerId: string,
    limit: number = 10
  ) {
    const events = await prisma.event.findMany({
      where: {
        organizerId
      },
      include: {
        orders: {
          where: {
            paymentStatus: 'APPROVED'
          },
          include: {
            tickets: true
          }
        }
      },
      take: limit
    })

    return events.map(event => {
      const totalRevenue = event.orders.reduce((sum, order) => sum + order.totalAmount, 0)
      const totalTickets = event.orders.reduce((sum, order) => sum + order.tickets.length, 0)

      return {
        id: event.id,
        title: event.title,
        totalRevenue,
        totalTickets,
        totalOrders: event.orders.length
      }
    })
  }

  static async getLotPerformance(
    eventId: string
  ) {
    const lots = await prisma.lot.findMany({
      where: { eventId },
      include: {
        tickets: {
          include: {
            order: true
          }
        }
      }
    })

    return lots.map(lot => {
      const approvedTickets = lot.tickets.filter(ticket => ticket.order?.paymentStatus === 'APPROVED')
      const soldTickets = approvedTickets.length
      const revenue = approvedTickets.reduce(
        (sum, ticket) => sum + ticket.price,
        0
      )

      return {
        id: lot.id,
        name: lot.name,
        price: lot.price,
        totalQuantity: lot.totalQuantity,
        availableQuantity: lot.availableQuantity,
        soldTickets,
        revenue,
        occupancyRate: lot.totalQuantity > 0 
          ? (soldTickets / lot.totalQuantity) * 100 
          : 0
      }
    })
  }
}

export const analyticsService = new AnalyticsService()
