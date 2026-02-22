import { describe, it, expect, beforeEach } from '@jest/globals'
import { AdminService } from '../admin-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn()
    },
    ticket: {
      count: jest.fn()
    },
    user: {
      count: jest.fn()
    },
    event: {
      count: jest.fn()
    },
    payout: {
      count: jest.fn(),
      update: jest.fn()
    }
  }
}))

describe('AdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPlatformStats', () => {
    it('should calculate platform stats', async () => {
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 10000 }
      })

      ;(prisma.order.count as jest.Mock).mockResolvedValue(100)
      ;(prisma.ticket.count as jest.Mock).mockResolvedValue(200)
      ;(prisma.user.count as jest.Mock).mockResolvedValue(30)
      ;(prisma.event.count as jest.Mock).mockResolvedValue(20)

      const stats = await AdminService.getPlatformStats()

      expect(stats.totalRevenue).toBe(10000)
      expect(stats.totalOrders).toBe(100)
      expect(stats.totalTickets).toBe(200)
      expect(stats.totalOrganizers).toBe(30)
      expect(stats.totalEvents).toBe(20)
    })
  })

  describe('getDisputeStats', () => {
    it('should calculate dispute statistics', async () => {
      ;(prisma.order.count as jest.Mock).mockResolvedValueOnce(5).mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)

      const stats = await AdminService.getDisputeStats(30)

      expect(stats.pending).toBe(5)
      expect(stats.resolved).toBe(3)
      expect(stats.escalated).toBe(2)
      expect(stats.avgResolutionTime).toBe(2.5)
    })
  })

  describe('getAnticipationStats', () => {
    it('should calculate anticipation statistics', async () => {
      ;(prisma.payout.count as jest.Mock).mockResolvedValueOnce(10).mockResolvedValueOnce(8)
        .mockResolvedValueOnce(5)

      const stats = await AdminService.getAnticipationStats(30)

      expect(stats.pending).toBe(10)
      expect(stats.approved).toBe(8)
      expect(stats.rejected).toBe(5)
      expect(stats.avgProcessingTime).toBe(2.5)
    })
  })

  describe('approveAnticipation', () => {
    it('should approve anticipation', async () => {
      ;(prisma.payout.update as jest.Mock).mockResolvedValue({})

      await AdminService.approveAnticipation('payout1')

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout1' },
        data: {
          status: 'APPROVED',
          processedAt: expect.any(Date)
        }
      })
    })
  })

  describe('rejectAnticipation', () => {
    it('should reject anticipation with reason', async () => {
      ;(prisma.payout.update as jest.Mock).mockResolvedValue({})

      await AdminService.rejectAnticipation('payout1', 'Insufficient documentation')

      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout1' },
        data: {
          status: 'CANCELLED',
          processedAt: expect.any(Date)
        }
      })
    })
  })

  describe('getRecentActivity', () => {
    it('should return recent activity', async () => {
      const mockOrders = [
        {
          id: 'order1',
          createdAt: new Date('2024-01-01')
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders as any)

      const activity = await AdminService.getRecentActivity(50)

      expect(activity).toHaveLength(1)
      expect(activity[0].type).toBe('ORDER')
      expect(activity[0].data.id).toBe('order1')
    })
  })
})
