import { prisma } from '@/lib/db/prisma'
import { WaitlistService } from './waitlist-service'

export class ProfileService {
  static async getAttendeeProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startTime: true,
                imageUrl: true
              }
            },
            tickets: {
              include: {
                lot: true,
                seat: {
                  include: {
                    sector: true
                  }
                }
              }
            }
          }
        },
        tickets: {
          include: {
            event: true,
            lot: true,
            seat: true,
            checkins: true
          }
        }
      }
    })

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cpf: user.cpf
      },
      stats: {
        totalOrders: user.orders.length,
        totalTickets: user.tickets.length,
        usedTickets: user.tickets.filter(t => t.isUsed).length,
        upcomingEvents: user.tickets.filter(t => 
          !t.isUsed && new Date(t.event.startTime) > new Date()
        ).length
      }
    }
  }

  static async updateProfile(
    userId: string,
    updates: {
      name?: string
      phone?: string
    }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.phone && { phone: updates.phone })
      }
    })

    return user
  }

  static async getOrderHistory(
    userId: string,
    limit: number = 20
  ) {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            imageUrl: true
          }
        },
        tickets: {
          include: {
            lot: true,
            seat: {
              include: {
                sector: true
              }
            },
            checkins: true
          }
        },
        promocode: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return orders
  }

  static async getTicketWallet(userId: string) {
    const tickets = await prisma.ticket.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
            imageUrl: true
          }
        },
        lot: {
          select: {
            name: true,
            price: true
          }
        },
        seat: {
          include: {
            sector: {
              select: {
                name: true,
                color: true
              }
            }
          }
        },
        checkins: true
      },
      orderBy: {
        event: {
          startTime: 'desc'
        }
      }
    })

    const groupedByEvent = tickets.reduce((acc, ticket) => {
      const eventId = ticket.eventId
      if (!acc[eventId]) {
        acc[eventId] = []
      }
      acc[eventId].push(ticket)
      return acc
    }, {} as Record<string, typeof tickets>)

    return {
      tickets,
      events: Object.keys(groupedByEvent).map(eventId => ({
        id: eventId,
        title: groupedByEvent[eventId][0].event.title,
        startTime: groupedByEvent[eventId][0].event.startTime,
        location: groupedByEvent[eventId][0].event.location,
        imageUrl: groupedByEvent[eventId][0].event.imageUrl,
        ticketCount: groupedByEvent[eventId].length
      }))
    }
  }

  static async getWaitlistEntries(userId: string) {
    return await WaitlistService.getAllUserWaitlistEntries(userId)
  }
}

export const profileService = new ProfileService()
