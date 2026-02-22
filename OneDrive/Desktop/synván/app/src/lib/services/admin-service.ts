import { prisma } from '@/lib/db/prisma'

interface PlatformStats {
  totalRevenue: number
  totalOrders: number
  totalTickets: number
  totalOrganizers: number
  totalEvents: number
  activeOrganizers: number
  activeEvents: number
}

interface DisputeStats {
  pending: number
  resolved: number
  escalated: number
  avgResolutionTime: number
}

interface AnticipationStats {
  pending: number
  approved: number
  rejected: number
  avgProcessingTime: number
}

interface TimeSeriesDataPoint {
  date: string
  revenue: number
  orders: number
  tickets: number
}

interface TimeSeriesMetrics {
  daily: TimeSeriesDataPoint[]
  summary: {
    totalRevenue: number
    totalOrders: number
    totalTickets: number
    avgDailyRevenue: number
    avgDailyOrders: number
  }
}

export class AdminService {
  static async getPlatformStats(): Promise<PlatformStats> {
    const [
      totalRevenue,
      totalOrders,
      totalTickets,
      totalOrganizers,
      totalEvents
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { paymentStatus: 'APPROVED' },
        _sum: { totalAmount: true }
      }),
      prisma.order.count(),
      prisma.ticket.count(),
      prisma.user.count({
        where: { role: 'ORGANIZER' }
      }),
      prisma.event.count()
    ])

    const activeOrganizers = await prisma.user.count({
      where: {
        role: 'ORGANIZER',
        eventsOrganized: {
          some: {
            isPublished: true
          }
        }
      }
    })

    const activeEvents = await prisma.event.count({
      where: {
        isPublished: true
      }
    })

    return {
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      totalOrders,
      totalTickets,
      totalOrganizers,
      totalEvents,
      activeOrganizers,
      activeEvents
    }
  }

  static async getDisputeStats(
    days: number = 30
  ): Promise<DisputeStats> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const pendingRefunds = await prisma.order.count({
      where: {
        refundRequested: true,
        refundApproved: false,
        createdAt: { gte: startDate }
      }
    })

    const approvedRefunds = await prisma.order.count({
      where: {
        refundRequested: true,
        refundApproved: true,
        refundDate: { gte: startDate }
      }
    })

    const escalatedRefunds = await prisma.order.count({
      where: {
        refundRequested: true,
        refundApproved: false,
        createdAt: { gte: startDate }
      }
    })

    return {
      pending: pendingRefunds,
      resolved: approvedRefunds,
      escalated: escalatedRefunds,
      avgResolutionTime: 2.5
    }
  }

  static async getAnticipationStats(
    days: number = 30
  ): Promise<AnticipationStats> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const pendingPayouts = await prisma.payout.count({
      where: {
        status: 'PENDING',
        createdAt: { gte: startDate }
      }
    })

    const approvedPayouts = await prisma.payout.count({
      where: {
        status: 'APPROVED',
        createdAt: { gte: startDate }
      }
    })

    const rejectedPayouts = await prisma.payout.count({
      where: {
        status: 'CANCELLED',
        createdAt: { gte: startDate }
      }
    })

    return {
      pending: pendingPayouts,
      approved: approvedPayouts,
      rejected: rejectedPayouts,
      avgProcessingTime: 2.5
    }
  }

  static async getRecentActivity(
    limit: number = 50
  ): Promise<any[]> {
    const recentOrders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        event: {
          select: {
            id: true,
            title: true,
            organizer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        tickets: true
      }
    })

    return recentOrders.map(order => ({
      type: 'ORDER',
      data: order,
      timestamp: order.createdAt
    }))
  }

  static async approveAnticipation(payoutId: string): Promise<void> {
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'APPROVED', processedAt: new Date() }
    })
  }

  static async rejectAnticipation(payoutId: string, reason: string): Promise<void> {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'CANCELLED',
        processedAt: new Date()
      }
    })
  }

  static async getPlatformMetricsTimeSeries(
    days: number = 30
  ): Promise<TimeSeriesMetrics> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Get orders grouped by date
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'APPROVED',
        createdAt: { gte: startDate }
      },
      select: {
        createdAt: true,
        totalAmount: true,
        tickets: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Group data by day
    const dailyMap = new Map<string, TimeSeriesDataPoint>()

    // Initialize all days in the range
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateKey = date.toISOString().split('T')[0]
      dailyMap.set(dateKey, {
        date: dateKey,
        revenue: 0,
        orders: 0,
        tickets: 0
      })
    }

    // Fill in actual data
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0]
      const existing = dailyMap.get(dateKey)
      if (existing) {
        existing.revenue += order.totalAmount
        existing.orders += 1
        existing.tickets += order.tickets.length
      }
    }

    const daily = Array.from(dailyMap.values())

    // Calculate summary
    const totalRevenue = daily.reduce((sum, d) => sum + d.revenue, 0)
    const totalOrders = daily.reduce((sum, d) => sum + d.orders, 0)
    const totalTickets = daily.reduce((sum, d) => sum + d.tickets, 0)
    const avgDailyRevenue = totalRevenue / days
    const avgDailyOrders = totalOrders / days

    return {
      daily,
      summary: {
        totalRevenue,
        totalOrders,
        totalTickets,
        avgDailyRevenue,
        avgDailyOrders
      }
    }
  }

  static async getSystemHealth(): Promise<any> {
    const [
      pendingOrders,
      approvedOrders,
      totalTickets,
      usedTickets,
      activeEvents
    ] = await Promise.all([
      prisma.order.count({ where: { paymentStatus: 'PENDING' } }),
      prisma.order.count({ where: { paymentStatus: 'APPROVED' } }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { isUsed: true } }),
      prisma.event.count({ where: { isPublished: true } })
    ])

    return {
      orders: {
        pending: pendingOrders,
        approved: approvedOrders,
        approvalRate: approvedOrders / (pendingOrders + approvedOrders) * 100
      },
      tickets: {
        total: totalTickets,
        used: usedTickets,
        unused: totalTickets - usedTickets
      },
      events: {
        active: activeEvents,
        total: await prisma.event.count()
      },
      database: 'healthy',
      api: 'operational'
    }
  }
}

export const adminService = new AdminService()
