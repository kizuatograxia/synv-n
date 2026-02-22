import { prisma } from '@/lib/db/prisma'

export type LotUnsoldBehavior = 'expire' | 'rollover'

export interface LotRotationResult {
  lotsUpdated: number
  ticketsRolledOver: number
}

export class LotService {
  private static getLotUnsoldBehavior(): LotUnsoldBehavior {
    return (process.env.LOT_UNSOLD_BEHAVIOR || 'expire') as LotUnsoldBehavior
  }

  private static getCurrentDate(): Date {
    return new Date()
  }

  /**
   * Rotate lots for an event, handling unsold tickets based on LOT_UNSOLD_BEHAVIOR
   * - expire: Unsold tickets remain unavailable
   * - rollover: Unsold tickets from expired lots roll over to the next active lot
   */
  static async rotateLots(eventId: string, currentDate?: Date): Promise<LotRotationResult> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        lots: {
          orderBy: { startDate: 'asc' },
        },
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    const now = currentDate || this.getCurrentDate()
    let lotsUpdated = 0
    let ticketsRolledOver = 0
    const behavior = this.getLotUnsoldBehavior()

    for (const lot of event.lots) {
      if (lot.endDate < now && lot.isActive) {
        // Calculate unsold tickets (tickets with paid or pending orders)
        const soldTickets = await prisma.ticket.count({
          where: {
            lotId: lot.id,
            order: {
              paymentStatus: { in: ['APPROVED', 'PENDING'] },
            },
          },
        })
        const unsoldTickets = lot.totalQuantity - soldTickets

        // Deactivate the expired lot
        await prisma.lot.update({
          where: { id: lot.id },
          data: { isActive: false },
        })
        lotsUpdated++

        // Find and activate the next lot (by order in the sorted array)
        const currentLotIndex = event.lots.findIndex(l => l.id === lot.id)
        const nextLot = event.lots[currentLotIndex + 1]

        if (nextLot) {
          if (behavior === 'rollover' && unsoldTickets > 0) {
            // Roll over unsold tickets to the next lot
            await prisma.lot.update({
              where: { id: nextLot.id },
              data: {
                isActive: true,
                totalQuantity: { increment: unsoldTickets },
              },
            })
            ticketsRolledOver += unsoldTickets
          } else {
            await prisma.lot.update({
              where: { id: nextLot.id },
              data: { isActive: true },
            })
          }
          lotsUpdated++
        }
      }
    }

    return {
      lotsUpdated,
      ticketsRolledOver,
    }
  }

  /**
   * Calculate unsold tickets for a lot
   */
  static async calculateUnsoldTickets(lotId: string): Promise<number> {
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
    })

    if (!lot) {
      throw new Error('Lote não encontrado')
    }

    const soldTickets = await prisma.ticket.count({
      where: {
        lotId: lot.id,
        order: {
          paymentStatus: { in: ['APPROVED', 'PENDING'] },
        },
      },
    })

    return lot.totalQuantity - soldTickets
  }
}
