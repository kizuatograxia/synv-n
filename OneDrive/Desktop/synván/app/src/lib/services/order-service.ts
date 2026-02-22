import { FeeEngine, FeeAllocation, ProductType } from '../fees'
import { CartService, CartWithDetails } from './cart-service'
import { prisma } from '../db/prisma'
import { CreateOrderInput, UpdateOrderInput } from '../validations/order'
import { auditService } from './audit-service'
import { cacheInvalidatePattern } from '../cache/redis'

export interface OrderSummary {
  subtotal: number
  serviceFee: number
  processingFee: number
  discount: number
  total: number
  organizerReceives: number
  buyerPays: number
}

export class OrderService {
  /**
   * Validates half-price ticket allocation according to Brazilian Law 12.933/2013
   * - Students, disabled, and low-income youth: max 40% of total tickets
   * - Elderly (60+): no limit when ELDERLY_HALF_PRICE_UNLIMITED=true, otherwise 40%
   */
  static async validateHalfPriceAllocation(
    items: CreateOrderInput['items'],
    eventId: string
  ): Promise<void> {
    const elderlyUnlimited = process.env.ELDERLY_HALF_PRICE_UNLIMITED === 'true'

    // Get event's half-price configuration
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        halfPriceEnabled: true,
        halfPriceLimit: true,
        halfPriceElderlyFree: true,
      },
    })

    if (!event || !event.halfPriceEnabled) {
      // Half-price is disabled for this event
      const hasHalfPriceItems = items.some(
        item => item.ticketType === 'MEIA_ENTRADA'
      )
      if (hasHalfPriceItems) {
        throw new Error('Meia-entrada não disponível para este evento')
      }
      return
    }

    // Count total tickets and half-price tickets by eligibility
    let totalTickets = 0
    let halfPriceTickets = 0
    let elderlyHalfPriceTickets = 0

    for (const item of items) {
      totalTickets += item.quantity

      if (item.ticketType === 'MEIA_ENTRADA') {
        if (item.eligibility === 'ELDERLY') {
          elderlyHalfPriceTickets += item.quantity
        } else {
          halfPriceTickets += item.quantity
        }
      }
    }

    // Check non-elderly half-price limit (40% by default, configurable per event)
    const limitPercentage = event.halfPriceLimit / 100
    const maxHalfPriceTickets = Math.ceil(totalTickets * limitPercentage)

    if (halfPriceTickets > maxHalfPriceTickets) {
      throw new Error(
        `Limite de meia-entrada excedido. Máximo permitido: ${event.halfPriceLimit}% dos ingressos (${maxHalfPriceTickets} ingressos)`
      )
    }

    // Check elderly limit (only applies if not unlimited)
    if (!elderlyUnlimited && !event.halfPriceElderlyFree) {
      const maxElderlyTickets = Math.ceil(totalTickets * limitPercentage)
      if (elderlyHalfPriceTickets > maxElderlyTickets) {
        throw new Error(
          `Limite de meia-entrada para idosos excedido. Máximo permitido: ${event.halfPriceLimit}% dos ingressos (${maxElderlyTickets} ingressos)`
        )
      }
    }
  }

  static async calculateOrderSummary(
    cartItems: CartWithDetails[],
    eventId: string,
    feeAllocation: FeeAllocation,
    promocodeId?: string
  ): Promise<OrderSummary> {
    const subtotal = CartService.calculateCartTotal(cartItems)

    let discount = 0
    if (promocodeId) {
      const promocode = await prisma.promocode.findUnique({
        where: { id: promocodeId },
      })

      if (promocode && promocode.isActive) {
        if (promocode.expiresAt && promocode.expiresAt < new Date()) {
          throw new Error('Cupom expirado')
        }

        if (promocode.maxUsage && promocode.currentUsage >= promocode.maxUsage) {
          throw new Error('Cupom esgotado')
        }

        if (promocode.discountType === 'PERCENTAGE') {
          discount = subtotal * (promocode.discountValue / 100)
        } else {
          discount = promocode.discountValue
        }

        discount = Math.min(discount, subtotal)
      }
    }

    const taxableAmount = subtotal - discount
    const feeBreakdown = FeeEngine.calculateFeesWithAllocation(
      taxableAmount,
      'STANDARD',
      feeAllocation
    )

    const organizerReceivesWithDiscount = discount > 0
      ? feeBreakdown.organizerReceives - (discount - feeBreakdown.processingFee)
      : feeBreakdown.organizerReceives

    return {
      subtotal,
      serviceFee: feeBreakdown.serviceFee,
      processingFee: feeBreakdown.processingFee,
      discount,
      total: feeBreakdown.buyerPays - discount,
      organizerReceives: organizerReceivesWithDiscount,
      buyerPays: feeBreakdown.buyerPays - discount,
    }
  }

  static async createOrder(
    userId: string,
    input: CreateOrderInput,
    eventId: string
  ) {
    const cartWithDetails = await CartService.getCartWithDetails(
      input.items,
      eventId
    )

    CartService.validateCartItems(input.items)

    // Validate half-price allocation limits
    await this.validateHalfPriceAllocation(input.items, eventId)

    let promocodeId: string | undefined
    if (input.promocode) {
      const promocode = await prisma.promocode.findUnique({
        where: { code: input.promocode.toUpperCase() },
      })

      if (!promocode) {
        throw new Error('Cupom inválido')
      }

      promocodeId = promocode.id
    }

    const summary = await this.calculateOrderSummary(
      cartWithDetails,
      eventId,
      input.feeAllocation,
      promocodeId
    )

    const installmentAmount = input.installments > 1
      ? FeeEngine.calculateInstallmentFees(summary.total, input.installments)
      : null

    const totalAmount = installmentAmount
      ? installmentAmount.totalAmount
      : summary.total

    const order = await prisma.order.create({
      data: {
        totalAmount,
        paymentMethod: input.paymentMethod,
        userId,
        eventId,
        promocodeId,
      },
    })

    const ticketIds: string[] = []
    const seatIds: string[] = []

    for (const cartItem of cartWithDetails) {
      const itemSeatIds = cartItem.seatIds || []

      for (let i = 0; i < cartItem.quantity; i++) {
        const ticket = await prisma.ticket.create({
          data: {
            code: CartService.generateTicketCode(),
            type: cartItem.ticketType,
            eligibility: cartItem.ticketType === 'MEIA_ENTRADA'
              ? cartItem.eligibility || null
              : null,
            price: cartItem.lotPrice,
            userId,
            eventId,
            lotId: cartItem.lotId,
            orderId: order.id,
          },
        })
        ticketIds.push(ticket.id)
      }

      if (itemSeatIds.length > 0) {
        seatIds.push(...itemSeatIds)
      }

      await prisma.lot.update({
        where: { id: cartItem.lotId },
        data: {
          availableQuantity: {
            decrement: cartItem.quantity,
          },
        },
      })
    }

    if (seatIds.length > 0 && ticketIds.length > 0) {
      await CartService.linkSeatsToTickets(ticketIds, seatIds)

      // Invalidate seat availability cache for all affected seat maps
      const seats = await prisma.seat.findMany({
        where: { id: { in: seatIds } },
        select: { seatMapId: true }
      })

      const uniqueSeatMapIds = Array.from(new Set(seats.map(s => s.seatMapId)))
      await Promise.all(
        uniqueSeatMapIds.map(mapId =>
          cacheInvalidatePattern(`seat-availability:${mapId}:*`)
        )
      )
    }

    if (promocodeId) {
      await prisma.promocode.update({
        where: { id: promocodeId },
        data: {
          currentUsage: {
            increment: 1,
          },
        },
      })
    }

    return {
      order,
      summary,
      installmentDetails: installmentAmount,
    }
  }

  static async getOrdersByUser(userId: string, eventId?: string) {
    const where: any = { userId }

    if (eventId) {
      where.eventId = eventId
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            imageUrl: true,
          },
        },
        tickets: {
          include: {
            lot: {
              select: {
                name: true,
              },
            },
          },
        },
        promocode: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return orders
  }

  static async getOrderById(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        event: true,
        tickets: {
          include: {
            lot: true,
          },
        },
        promocode: true,
      },
    })

    if (!order) {
      throw new Error('Pedido não encontrado')
    }

    return order
  }

  static async updateOrder(orderId: string, userId: string, data: UpdateOrderInput) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
    })

    if (!order) {
      throw new Error('Pedido não encontrado')
    }

    if (order.paymentStatus === 'APPROVED') {
      throw new Error('Não é possível modificar um pedido aprovado')
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data,
    })

    return updatedOrder
  }

  static async requestRefund(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        tickets: {
          where: { isUsed: true },
        },
        event: true,
      },
    })

    if (!order) {
      throw new Error('Pedido não encontrado')
    }

    if (order.paymentStatus !== 'APPROVED') {
      throw new Error('Apenas pedidos aprovados podem ter reembolso solicitado')
    }

    if (order.tickets.some(t => t.isUsed)) {
      throw new Error('Não é possível reembolsar ingressos já utilizados')
    }

    if (order.refundRequested) {
      throw new Error('Reembolso já solicitado')
    }

    const isWithin7Days = Math.abs(
      Date.now() - order.createdAt.getTime()
    ) / (1000 * 60 * 60 * 24) <= 7

    const isMoreThan48hBeforeEvent = order.event.startTime.getTime() - Date.now() > 48 * 60 * 60 * 1000

    // Calculate refund based on the amount actually paid (totalAmount already includes promocode discount)
    // This ensures refunds are based on discounted price when promocodes were used
    const refundCalc = FeeEngine.calculateRefund(
      order.totalAmount,
      isWithin7Days,
      isMoreThan48hBeforeEvent,
      false
    )

    if (refundCalc.refundAmount === 0) {
      // Log refund rejection
      await auditService.logRefund(orderId, userId, {
        approved: false,
        amount: 0,
        rejectedReason: 'Not eligible for refund based on policy (CDC 7-day rule and 48h pre-event policy)',
      })
      throw new Error('Não elegível para reembolso')
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        refundRequested: true,
        refundApproved: false,
      },
    })

    // Log refund request approval
    await auditService.logRefund(orderId, userId, {
      approved: true,
      amount: refundCalc.refundAmount,
      reason: isWithin7Days ? 'Within 7 days of purchase (CDC rule)' : 'More than 48h before event',
    })

    return {
      order: updatedOrder,
      refundAmount: refundCalc.refundAmount,
    }
  }
}
