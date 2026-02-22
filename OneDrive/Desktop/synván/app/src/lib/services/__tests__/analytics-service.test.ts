import { describe, it, expect, beforeEach } from '@jest/globals'
import { AnalyticsService } from '../analytics-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    ticket: {
      findMany: jest.fn()
    },
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    lot: {
      findMany: jest.fn()
    }
  }
}))

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getOrganizerSalesSummary', () => {
    it('should calculate sales summary correctly', async () => {
      const mockOrders = [
        {
          totalAmount: 500,
          tickets: [{}, {}]
        },
        {
          totalAmount: 300,
          tickets: [{}]
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders as any)

      const result = await AnalyticsService.getOrganizerSalesSummary('organizer1')

      expect(result.totalRevenue).toBe(800)
      expect(result.totalTicketsSold).toBe(3)
      expect(result.totalOrders).toBe(2)
      expect(result.averageOrderValue).toBe(400)
    })

    it('should return zero values when no orders', async () => {
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])

      const result = await AnalyticsService.getOrganizerSalesSummary('organizer1')

      expect(result.totalRevenue).toBe(0)
      expect(result.totalTicketsSold).toBe(0)
      expect(result.totalOrders).toBe(0)
      expect(result.averageOrderValue).toBe(0)
    })
  })

  describe('getDailySales', () => {
    it('should group sales by date', async () => {
      const mockOrders = [
        {
          totalAmount: 500,
          createdAt: new Date('2024-01-01'),
          tickets: [{}, {}]
        },
        {
          totalAmount: 300,
          createdAt: new Date('2024-01-02'),
          tickets: [{}]
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders as any)

      const result = await AnalyticsService.getDailySales('organizer1', undefined, 30)

      expect(result).toHaveLength(2)
      expect(result[0].date).toBe('2024-01-01')
      expect(result[0].revenue).toBe(500)
      expect(result[0].ticketsSold).toBe(2)
    })
  })

  describe('getAttendeeDemographics', () => {
    it('should calculate demographics correctly', async () => {
      const mockTickets = [
        {
          type: 'GENERAL',
          order: {
            paymentMethod: 'CREDIT_CARD'
          }
        },
        {
          type: 'VIP',
          order: {
            paymentMethod: 'PIX'
          }
        }
      ]

      ;(prisma.ticket.findMany as jest.Mock).mockResolvedValue(mockTickets as any)

      const result = await AnalyticsService.getAttendeeDemographics('organizer1')

      expect(result.ticketTypes).toEqual({
        GENERAL: 1,
        VIP: 1
      })
      expect(result.paymentMethods).toEqual({
        CREDIT_CARD: 1,
        PIX: 1
      })
    })
  })

  describe('getRealTimeStats', () => {
    it('should calculate real-time stats correctly', async () => {
      const mockTodayOrders = [
        {
          totalAmount: 500,
          tickets: [{}, {}]
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockTodayOrders as any)
      ;(prisma.order.count as jest.Mock).mockResolvedValueOnce(5).mockResolvedValueOnce(10)

      const result = await AnalyticsService.getRealTimeStats('organizer1')

      expect(result.todayRevenue).toBe(500)
      expect(result.activeTicketsSold).toBe(2)
      expect(result.pendingOrders).toBe(5)
      expect(result.approvedOrders).toBe(10)
    })
  })

  describe('getLotPerformance', () => {
    it('should calculate lot performance metrics', async () => {
      const mockLots = [
        {
          id: 'lot1',
          name: 'Lote 1',
          price: 100,
          totalQuantity: 100,
          availableQuantity: 60,
          tickets: [
            {
              price: 100,
              order: {
                paymentStatus: 'APPROVED'
              }
            },
            {
              price: 100,
              order: {
                paymentStatus: 'APPROVED'
              }
            }
          ]
        }
      ]

      ;(prisma.lot.findMany as jest.Mock).mockResolvedValue(mockLots as any)

      const result = await AnalyticsService.getLotPerformance('event1')

      expect(result).toHaveLength(1)
      expect(result[0].soldTickets).toBe(2)
      expect(result[0].revenue).toBe(200)
      expect(result[0].occupancyRate).toBe(2)
    })
  })
})
