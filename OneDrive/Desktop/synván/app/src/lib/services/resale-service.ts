import { prisma } from '../db/prisma'
import { QRCodeService } from '../qrcode/qrcode-service'
import { FeeEngine } from '../fees'

export interface CreateResaleListingInput {
  ticketId: string
  resalePrice: number
}

export interface BuyResaleTicketInput {
  resaleListingId: string
  paymentMethod: string
}

export interface ResaleListingSummary {
  id: string
  resalePrice: number
  originalPrice: number
  status: string
  expiresAt: Date
  ticket: {
    id: string
    code: string
    type: string
    seat?: {
      label: string
    }
  }
  event: {
    id: string
    title: string
    startTime: Date
    location: string
    imageUrl?: string
  }
  seller: {
    id: string
    name: string
  }
}

export class ResaleService {
  static readonly RESALE_FEE_PERCENTAGE = 0.10
  static readonly RESALE_LISTING_DURATION_DAYS = 30
  static readonly RESALE_MAX_PRICE_PERCENTAGE = 1.0

  static async createResaleListing(
    userId: string,
    input: CreateResaleListingInput
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: input.ticketId },
      include: {
        event: true,
        user: true,
        resaleListing: true,
      },
    })

    if (!ticket) {
      throw new Error('Ingresso não encontrado')
    }

    if (ticket.userId !== userId) {
      throw new Error('Apenas o proprietário pode listar o ingresso para revenda')
    }

    if (ticket.userId !== userId) {
      throw new Error('Apenas o proprietário pode listar o ingresso para revenda')
    }

    if (ticket.isUsed) {
      throw new Error('Ingressos já utilizados não podem ser revendidos')
    }

    if (ticket.event.startTime < new Date()) {
      throw new Error('Eventos já finalizados não permitem revenda')
    }

    if (ticket.resaleListing) {
      throw new Error('Este ingresso já está listado para revenda')
    }

    const maxPrice = ticket.price * this.RESALE_MAX_PRICE_PERCENTAGE

    if (input.resalePrice > maxPrice) {
      throw new Error(
        `Preço de revenda não pode exceder o valor original de R$ ${ticket.price.toFixed(2)}`
      )
    }

    if (input.resalePrice < 0) {
      throw new Error('Preço de revenda inválido')
    }

    const expiresAt = new Date()
    expiresAt.setDate(
      expiresAt.getDate() + this.RESALE_LISTING_DURATION_DAYS
    )

    const listing = await prisma.resaleListing.create({
      data: {
        resalePrice: input.resalePrice,
        originalPrice: ticket.price,
        expiresAt,
        ticketId: ticket.id,
        sellerId: userId,
        eventId: ticket.eventId,
      },
    })

    return listing
  }

  static async getResaleListings(filters?: {
    eventId?: string
    status?: string
    minPrice?: number
    maxPrice?: number
  }) {
    const where: any = {
      status: 'ACTIVE',
      expiresAt: {
        gt: new Date(),
      },
    }

    if (filters?.eventId) {
      where.eventId = filters.eventId
    }

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.minPrice !== undefined) {
      where.resalePrice = {
        ...where.resalePrice,
        gte: filters.minPrice,
      }
    }

    if (filters?.maxPrice !== undefined) {
      where.resalePrice = {
        ...where.resalePrice,
        lte: filters.maxPrice,
      }
    }

    const listings = await prisma.resaleListing.findMany({
      where,
      include: {
        ticket: {
          include: {
            seat: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
            imageUrl: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return listings as ResaleListingSummary[]
  }

  static async getResaleListingById(id: string) {
    const listing = await prisma.resaleListing.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            seat: true,
            lot: true,
          },
        },
        event: true,
        seller: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!listing) {
      throw new Error('Listing não encontrado')
    }

    return listing
  }

  static async getResaleListingsByUser(userId: string) {
    const listings = await prisma.resaleListing.findMany({
      where: {
        sellerId: userId,
      },
      include: {
        ticket: {
          include: {
            seat: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return listings
  }

  static async cancelResaleListing(listingId: string, userId: string) {
    const listing = await prisma.resaleListing.findUnique({
      where: { id: listingId },
    })

    if (!listing) {
      throw new Error('Listing não encontrado')
    }

    if (listing.sellerId !== userId) {
      throw new Error('Apenas o vendedor pode cancelar a revenda')
    }

    if (listing.status !== 'ACTIVE') {
      throw new Error('Apenas listings ativos podem ser cancelados')
    }

    const updatedListing = await prisma.resaleListing.update({
      where: { id: listingId },
      data: {
        status: 'CANCELLED',
      },
    })

    return updatedListing
  }

  static async buyResaleTicket(
    buyerId: string,
    input: BuyResaleTicketInput
  ) {
    const listing = await prisma.resaleListing.findUnique({
      where: { id: input.resaleListingId },
      include: {
        ticket: {
          include: {
            event: true,
          },
        },
        event: true,
      },
    })

    if (!listing) {
      throw new Error('Listing não encontrado')
    }

    // Fetch the full ticket with seat relation
    const fullTicket = await prisma.ticket.findUnique({
      where: { id: listing.ticketId },
      include: {
        seat: true,
      },
    })

    if (!fullTicket) {
      throw new Error('Ingresso não encontrado')
    }

    if (listing.status !== 'ACTIVE') {
      throw new Error('Este ingresso não está mais disponível')
    }

    if (listing.expiresAt < new Date()) {
      throw new Error('Este listing expirou')
    }

    if (listing.sellerId === buyerId) {
      throw new Error('Você não pode comprar seu próprio ingresso')
    }

    if (listing.ticket.isUsed) {
      throw new Error('Este ingresso já foi utilizado')
    }

    if (listing.ticket.userId !== listing.sellerId) {
      throw new Error('O ingresso não pertence mais ao vendedor original')
    }

    const resaleFee = listing.resalePrice * this.RESALE_FEE_PERCENTAGE
    const sellerReceives = listing.resalePrice - resaleFee

    const order = await prisma.order.create({
      data: {
        totalAmount: listing.resalePrice,
        paymentMethod: input.paymentMethod as any,
        paymentStatus: 'APPROVED',
        userId: buyerId,
        eventId: listing.eventId,
      },
    })

    const newTicket = await prisma.ticket.create({
      data: {
        code: QRCodeService.generateUniqueCode(),
        type: fullTicket.type,
        price: listing.resalePrice,
        userId: buyerId,
        eventId: listing.eventId,
        lotId: fullTicket.lotId,
        orderId: order.id,
      },
    })

    if (fullTicket.seat) {
      await prisma.seat.update({
        where: { id: fullTicket.seat.id },
        data: {
          ticketId: newTicket.id,
          status: 'SOLD',
        },
      })
    }

    await prisma.ticket.update({
      where: { id: listing.ticket.id },
      data: {
        isUsed: true,
      },
    })

    const updatedListing = await prisma.resaleListing.update({
      where: { id: listing.id },
      data: {
        status: 'SOLD',
        buyerId,
        buyerPaymentId: order.id,
        soldAt: new Date(),
      },
    })

    return {
      order,
      ticket: newTicket,
      listing: updatedListing,
      feeBreakdown: {
        resaleFee,
        sellerReceives,
      },
    }
  }

  static async processResalePayout(listingId: string) {
    const listing = await prisma.resaleListing.findUnique({
      where: { id: listingId },
      include: {
        seller: true,
      },
    })

    if (!listing) {
      throw new Error('Listing não encontrado')
    }

    if (listing.status !== 'SOLD') {
      throw new Error('Apenas listings vendidos podem ter payout processado')
    }

    if (listing.sellerPayoutId) {
      throw new Error('Payout já foi processado')
    }

    const resaleFee = listing.resalePrice * this.RESALE_FEE_PERCENTAGE
    const netAmount = listing.resalePrice - resaleFee

    const payout = await prisma.payout.create({
      data: {
        totalSales: listing.resalePrice,
        totalFees: resaleFee,
        netAmount,
        finalPayout: netAmount,
        status: 'PENDING',
        userId: listing.sellerId,
      },
    })

    await prisma.resaleListing.update({
      where: { id: listingId },
      data: {
        sellerPayoutId: payout.id,
        payoutId: payout.id,
      },
    })

    return payout
  }

  static async expireResaleListings() {
    const expiredListings = await prisma.resaleListing.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    })

    return expiredListings
  }

  static async validateTicketForResale(ticketId: string, userId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        event: true,
        resaleListing: true,
        checkins: true,
      },
    })

    if (!ticket) {
      return {
        valid: false,
        reason: 'Ingresso não encontrado',
      }
    }

    if (ticket.userId !== userId) {
      return {
        valid: false,
        reason: 'Você não é o proprietário deste ingresso',
      }
    }

    if (ticket.isUsed) {
      return {
        valid: false,
        reason: 'Ingresso já utilizado',
      }
    }

    if (ticket.event.startTime < new Date()) {
      return {
        valid: false,
        reason: 'Evento já finalizado',
      }
    }

    if (ticket.resaleListing) {
      return {
        valid: false,
        reason: 'Ingresso já está listado para revenda',
      }
    }

    if (ticket.checkins.length > 0) {
      return {
        valid: false,
        reason: 'Ingresso já foi usado no check-in',
      }
    }

    return {
      valid: true,
      originalPrice: ticket.price,
      maxResalePrice: ticket.price,
      eventTitle: ticket.event.title,
      eventDate: ticket.event.startTime,
    }
  }
}
