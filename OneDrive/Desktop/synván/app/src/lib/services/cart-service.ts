import { CartItem } from '../validations/order'
import { prisma } from '../db/prisma'

export interface CartWithDetails extends CartItem {
  lotName: string
  lotPrice: number
  availableQuantity: number
  total: number
  seats?: Array<{
    id: string
    label: string
    sectorName?: string
    seatPrice: number
  }>
}

/**
 * CartService - Utility functions for cart validation and calculations
 * Note: Cart persistence is now handled frontend-only via localStorage (see hooks/useCart.ts)
 */
export class CartService {
  /**
   * Get cart with details for validation and display
   */
  static async getCartWithDetails(
    items: CartItem[],
    eventId: string
  ): Promise<CartWithDetails[]> {
    const lotIds = items.map(item => item.lotId)
    const seatIds = items.flatMap(item => item.seatIds || [])

    const lots = await prisma.lot.findMany({
      where: {
        id: { in: lotIds },
        eventId,
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      select: {
        id: true,
        name: true,
        price: true,
        availableQuantity: true,
      },
    })

    let seatDetails: any[] = []
    if (seatIds.length > 0) {
      seatDetails = await prisma.seat.findMany({
        where: {
          id: { in: seatIds },
          seatMap: {
            eventId
          },
          status: 'RESERVED'
        },
        include: {
          sector: true
        }
      })
    }

    return items.map(item => {
      const lot = lots.find(l => l.id === item.lotId)
      if (!lot) {
        throw new Error(`Lote ${item.lotId} não encontrado ou indisponível`)
      }

      if (item.quantity > lot.availableQuantity) {
        throw new Error(`Quantidade indisponível para o lote ${lot.name}`)
      }

      const itemSeatIds = item.seatIds || []
      const itemSeats = seatDetails.filter(s => itemSeatIds.includes(s.id))

      const seatTotal = itemSeats.reduce((sum, seat) => {
        return sum + (seat.sector?.price || lot.price)
      }, 0)

      return {
        ...item,
        lotName: lot.name,
        lotPrice: lot.price,
        availableQuantity: lot.availableQuantity,
        total: itemSeatIds.length > 0 ? seatTotal : lot.price * item.quantity,
        seats: itemSeats.length > 0 ? itemSeats.map(seat => ({
          id: seat.id,
          label: seat.label,
          sectorName: seat.sector?.name,
          seatPrice: seat.sector?.price || lot.price
        })) : undefined
      }
    })
  }

  static calculateCartTotal(items: CartWithDetails[]): number {
    return items.reduce((sum, item) => sum + item.total, 0)
  }

  static validateCartItems(items: CartItem[]): void {
    if (items.length === 0) {
      throw new Error('Carrinho vazio')
    }

    const lotIds = items.map(item => item.lotId)
    const uniqueLotIds = new Set(lotIds)

    if (lotIds.length !== uniqueLotIds.size) {
      throw new Error('Lotes duplicados no carrinho')
    }

    items.forEach(item => {
      if (item.quantity < 1) {
        throw new Error('Quantidade deve ser ao menos 1')
      }

      if (item.quantity > 10) {
        throw new Error('Máximo de 10 ingressos por compra')
      }

      if (item.seatIds && item.seatIds.length !== item.quantity) {
        throw new Error('Número de assentos deve ser igual à quantidade')
      }
    })
  }

  static generateTicketCode(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 9)
    return `${timestamp}${random}`.toUpperCase()
  }

  static async getSeatsWithDetails(
    seatIds: string[],
    eventId: string
  ) {
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        seatMap: {
          eventId
        },
        status: 'RESERVED'
      },
      include: {
        sector: true,
        lot: true,
        seatMap: true
      }
    })

    if (seats.length !== seatIds.length) {
      throw new Error('Alguns assentos não estão disponíveis')
    }

    return seats
  }

  static async reserveSeatsForOrder(
    seatIds: string[],
    userId: string,
    reservationTimeout: number = 900000
  ) {
    const timeoutDate = new Date(Date.now() + reservationTimeout)

    const result = await prisma.$transaction(async (tx) => {
      const seats = await tx.seat.findMany({
        where: {
          id: { in: seatIds },
          status: 'AVAILABLE'
        }
      })

      if (seats.length !== seatIds.length) {
        throw new Error('Alguns assentos não estão disponíveis')
      }

      await Promise.all(
        seats.map(seat =>
          tx.seat.update({
            where: { id: seat.id },
            data: {
              status: 'RESERVED',
              reservedAt: timeoutDate,
              reservedBy: userId
            }
          })
        )
      )

      return seats
    })

    return result
  }

  static async releaseAllSeatReservations(userId: string) {
    return await prisma.seat.updateMany({
      where: {
        status: 'RESERVED',
        reservedBy: userId
      },
      data: {
        status: 'AVAILABLE',
        reservedAt: null,
        reservedBy: null
      }
    })
  }

  static async linkSeatsToTickets(ticketIds: string[], seatIds: string[]) {
    if (ticketIds.length !== seatIds.length) {
      throw new Error('Número de tickets e assentos deve ser igual')
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ticketIds.length; i++) {
        await tx.seat.update({
          where: { id: seatIds[i] },
          data: {
            status: 'SOLD',
            ticketId: ticketIds[i],
            reservedAt: null,
            reservedBy: null
          }
        })
      }
    })
  }

  static async validateSeatAvailability(seatIds: string[], eventId: string) {
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: seatIds },
        seatMap: {
          eventId
        }
      },
      include: {
        sector: true,
        lot: true
      }
    })

    if (seats.length !== seatIds.length) {
      throw new Error('Alguns assentos não foram encontrados')
    }

    const unavailableSeats = seats.filter(seat => seat.status !== 'AVAILABLE')
    if (unavailableSeats.length > 0) {
      throw new Error('Alguns assentos já não estão disponíveis')
    }

    return seats
  }
}
