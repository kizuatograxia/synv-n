import { describe, it, expect, beforeEach } from '@jest/globals'
import { ProfileService } from '../profile-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    order: {
      findMany: jest.fn()
    },
    ticket: {
      findMany: jest.fn()
    }
  }
}))

describe('ProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getAttendeeProfile', () => {
    it('should return user profile with stats', async () => {
      const mockUser = {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        cpf: '12345678901',
        orders: [
          {
            totalAmount: 500,
            tickets: [{}, {}]
          }
        ],
        tickets: [
          { isUsed: true, event: { startTime: new Date('2099-12-31') } },
          { isUsed: false, event: { startTime: new Date('2099-12-31') } },
          { isUsed: false, event: { startTime: new Date('2099-12-31') } }
        ]
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any)

      const result = await ProfileService.getAttendeeProfile('user1')

      expect(result.user).toEqual({
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        cpf: '12345678901'
      })
      expect(result.stats.totalOrders).toBe(1)
      expect(result.stats.totalTickets).toBe(3)
      expect(result.stats.usedTickets).toBe(1)
      expect(result.stats.upcomingEvents).toBe(2)
    })
  })

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        id: 'user1',
        name: 'Updated Name'
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(mockUser as any)

      const result = await ProfileService.updateProfile('user1', {
        name: 'Updated Name'
      })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { name: 'Updated Name' }
      })
      expect(result).toEqual(mockUser)
    })
  })

  describe('getOrderHistory', () => {
    it('should return order history with limit', async () => {
      const mockOrders = [
        { id: 'order1', createdAt: new Date('2024-01-01') },
        { id: 'order2', createdAt: new Date('2024-01-02') }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders as any)

      const result = await ProfileService.getOrderHistory('user1', 10)

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10
      })
      expect(result).toHaveLength(2)
    })
  })

  describe('getTicketWallet', () => {
    it('should return ticket wallet grouped by event', async () => {
      const mockTickets = [
        {
          eventId: 'event1',
          event: { title: 'Event 1', startTime: new Date('2024-02-01') }
        },
        {
          eventId: 'event2',
          event: { title: 'Event 2', startTime: new Date('2024-02-02') }
        }
      ]

      ;(prisma.ticket.findMany as jest.Mock).mockResolvedValue(mockTickets as any)

      const result = await ProfileService.getTicketWallet('user1')

      expect(result.events).toHaveLength(2)
      expect(result.events[0].id).toBe('event1')
      expect(result.events[0].ticketCount).toBe(1)
      expect(result.events[1].ticketCount).toBe(1)
    })
  })
})
