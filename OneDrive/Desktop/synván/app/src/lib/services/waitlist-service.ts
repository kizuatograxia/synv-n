import { prisma } from '../db/prisma'

export interface JoinWaitlistInput {
  eventId: string
  lotId?: string
}

export class WaitlistService {
  static async joinWaitlist(userId: string, input: JoinWaitlistInput) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      include: {
        lots: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (input.lotId) {
      const lot = event.lots.find((l: any) => l.id === input.lotId)
      if (!lot) {
        throw new Error('Lote não encontrado')
      }

      if (lot.availableQuantity > 0) {
        const existingEntry = await prisma.waitlistEntry.findFirst({
          where: {
            userId,
            eventId: input.eventId,
            lotId: input.lotId,
          },
        })

        if (existingEntry) {
          throw new Error('Você já está na lista de espera')
        }

        const totalWaitlisted = await prisma.waitlistEntry.count({
          where: {
            eventId: input.eventId,
            lotId: input.lotId,
          },
        })

        const entry = await prisma.waitlistEntry.create({
          data: {
            userId,
            eventId: input.eventId,
            lotId: input.lotId,
            position: totalWaitlisted + 1,
          },
        })

        return entry
      } else {
        throw new Error('Este lote ainda tem ingressos disponíveis')
      }
    } else {
      const hasAvailableTickets = event.lots.some(
        (lot: any) => lot.availableQuantity > 0
      )

      if (hasAvailableTickets) {
        throw new Error('Este evento ainda tem ingressos disponíveis')
      }

      const existingEntry = await prisma.waitlistEntry.findFirst({
        where: {
          userId,
          eventId: input.eventId,
          lotId: null,
        },
      })

      if (existingEntry) {
        throw new Error('Você já está na lista de espera')
      }

      const totalWaitlisted = await prisma.waitlistEntry.count({
        where: {
          eventId: input.eventId,
          lotId: null,
        },
      })

      const entry = await prisma.waitlistEntry.create({
        data: {
          userId,
          eventId: input.eventId,
          lotId: null,
          position: totalWaitlisted + 1,
        },
      })

      return entry
    }
  }

  static async getUserWaitlistEntries(userId: string, eventId: string, lotId?: string) {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        userId,
        eventId,
        lotId: lotId || null,
      },
      include: {
        lot: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    })

    return entries
  }

  static async getAllUserWaitlistEntries(userId: string) {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        userId,
      },
      include: {
        lot: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
            imageUrl: true,
            isPublished: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return entries
  }

  static async getWaitlistEntries(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== userId) {
      throw new Error('Sem permissão para visualizar lista de espera')
    }

    const entries = await prisma.waitlistEntry.findMany({
      where: {
        eventId,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        lot: true,
      },
      orderBy: {
        position: 'asc',
      },
    })

    return entries
  }

  static async getWaitlistAnalytics(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== userId) {
      throw new Error('Sem permissão para visualizar analytics')
    }

    const totalWaitlisted = await prisma.waitlistEntry.count({
      where: {
        eventId,
      },
    })

    const notifiedCount = await prisma.waitlistEntry.count({
      where: {
        eventId,
        notified: true,
      },
    })

    const entriesByLot = await prisma.waitlistEntry.groupBy({
      by: ['lotId'],
      where: {
        eventId,
      },
      _count: true,
    })

    return {
      totalWaitlisted,
      notifiedCount,
      entriesByLot: entriesByLot.map((item) => ({
        lotId: item.lotId,
        count: item._count,
      })),
    }
  }

  static async leaveWaitlist(userId: string, eventId: string, lotId?: string) {
    const entry = await prisma.waitlistEntry.findFirst({
      where: {
        userId,
        eventId,
        lotId: lotId || null,
      },
    })

    if (!entry) {
      throw new Error('Você não está na lista de espera')
    }

    await prisma.waitlistEntry.delete({
      where: { id: entry.id },
    })

    return { success: true }
  }

  static async notifyWaitlist(eventId: string, lotId?: string) {
    const entries = await prisma.waitlistEntry.findMany({
      where: {
        eventId,
        lotId: lotId || null,
        notified: false,
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        event: {
          select: {
            title: true,
          },
        },
      },
      take: 10,
    })

    await prisma.waitlistEntry.updateMany({
      where: {
        id: {
          in: entries.map((e) => e.id),
        },
      },
      data: {
        notified: true,
      },
    })

    return {
      notified: entries.length,
      entries: entries,
    }
  }
}
