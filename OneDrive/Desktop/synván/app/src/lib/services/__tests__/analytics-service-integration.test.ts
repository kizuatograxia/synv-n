/**
 * Integration Tests for AnalyticsService Event Metrics Aggregation
 *
 * These tests verify event metrics aggregation functionality end-to-end:
 * - Previous period summary calculation
 * - Top selling events aggregation
 * - Event performance metrics
 * - Cross-period comparison calculations
 *
 * Testing Approach:
 * - Mocks database calls but tests the full service logic flow
 * - Tests data aggregation, filtering, and transformation
 * - Verifies edge cases (empty data, period boundaries)
 */

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

describe('AnalyticsService Event Metrics Aggregation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getPreviousPeriodSummary', () => {
    it('should calculate previous period summary correctly', async () => {
      const organizerId = 'organizer1'
      const eventId = 'event1'
      const days = 30

      // Mock previous period orders (should be fetched for days before today)
      const previousPeriodOrders = [
        {
          totalAmount: 1000,
          tickets: [{}, {}, {}]
        },
        {
          totalAmount: 500,
          tickets: [{}]
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(previousPeriodOrders as any)

      const result = await AnalyticsService.getPreviousPeriodSummary(
        organizerId,
        eventId,
        days
      )

      // Should calculate summary for the previous period (days before today)
      expect(result.totalRevenue).toBe(1500)
      expect(result.totalTicketsSold).toBe(4)
      expect(result.totalOrders).toBe(2)
      expect(result.averageOrderValue).toBe(750)
    })

    it('should calculate date range correctly for previous period', async () => {
      const organizerId = 'organizer1'
      const days = 7

      // Mock empty result
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])

      await AnalyticsService.getPreviousPeriodSummary(organizerId, undefined, days)

      // Verify that findMany was called with date range
      // Previous period should be from (today - days*2) to (today - days)
      const findManyCall = (prisma.order.findMany as jest.Mock).mock.calls[0]
      const whereClause = findManyCall[0].where

      expect(whereClause).toBeDefined()
      expect(whereClause.paymentStatus).toBe('APPROVED')
      expect(whereClause.event).toEqual({ organizerId })
      expect(whereClause.createdAt).toBeDefined()

      // The date range should span 'days' days, starting from 'days' days ago
      const startDate = whereClause.createdAt.gte
      const endDate = whereClause.createdAt.lt
      expect(startDate).toBeInstanceOf(Date)
      expect(endDate).toBeInstanceOf(Date)
    })

    it('should handle no event ID correctly', async () => {
      const organizerId = 'organizer1'
      const days = 30

      const mockOrders = [
        {
          totalAmount: 200,
          tickets: [{}]
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders as any)

      const result = await AnalyticsService.getPreviousPeriodSummary(
        organizerId,
        undefined,
        days
      )

      expect(result.totalRevenue).toBe(200)
      expect(result.totalOrders).toBe(1)

      // Verify eventId is not in the where clause
      const findManyCall = (prisma.order.findMany as jest.Mock).mock.calls[0]
      const whereClause = findManyCall[0].where
      expect(whereClause.eventId).toBeUndefined()
    })

    it('should return zero values when no previous period orders exist', async () => {
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])

      const result = await AnalyticsService.getPreviousPeriodSummary(
        'organizer1',
        'event1',
        30
      )

      expect(result.totalRevenue).toBe(0)
      expect(result.totalTicketsSold).toBe(0)
      expect(result.totalOrders).toBe(0)
      expect(result.averageOrderValue).toBe(0)
    })

    it('should handle zero order count for average calculation', async () => {
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])

      const result = await AnalyticsService.getPreviousPeriodSummary(
        'organizer1',
        undefined,
        30
      )

      expect(result.averageOrderValue).toBe(0)
    })
  })

  describe('getTopSellingEvents', () => {
    it('should aggregate event sales correctly', async () => {
      const organizerId = 'organizer1'
      const limit = 10

      const mockEvents = [
        {
          id: 'event1',
          title: 'Evento A',
          orders: [
            {
              totalAmount: 1000,
              tickets: [{}, {}, {}]
            },
            {
              totalAmount: 500,
              tickets: [{}]
            }
          ]
        },
        {
          id: 'event2',
          title: 'Evento B',
          orders: [
            {
              totalAmount: 300,
              tickets: [{}]
            }
          ]
        },
        {
          id: 'event3',
          title: 'Evento C',
          orders: [] // No orders
        }
      ]

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue(mockEvents as any)

      const result = await AnalyticsService.getTopSellingEvents(organizerId, limit)

      // Event A: 1000 + 500 = 1500 revenue, 4 tickets, 2 orders
      expect(result[0]).toEqual({
        id: 'event1',
        title: 'Evento A',
        totalRevenue: 1500,
        totalTickets: 4,
        totalOrders: 2
      })

      // Event B: 300 revenue, 1 ticket, 1 order
      expect(result[1]).toEqual({
        id: 'event2',
        title: 'Evento B',
        totalRevenue: 300,
        totalTickets: 1,
        totalOrders: 1
      })

      // Event C: 0 revenue, 0 tickets, 0 orders
      expect(result[2]).toEqual({
        id: 'event3',
        title: 'Evento C',
        totalRevenue: 0,
        totalTickets: 0,
        totalOrders: 0
      })
    })

    it('should filter by organizer ID', async () => {
      const organizerId = 'organizer1'

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])

      await AnalyticsService.getTopSellingEvents(organizerId, 5)

      const findManyCall = (prisma.event.findMany as jest.Mock).mock.calls[0]
      expect(findManyCall[0].where).toEqual({ organizerId })
    })

    it('should respect limit parameter', async () => {
      const organizerId = 'organizer1'
      const limit = 5

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])

      await AnalyticsService.getTopSellingEvents(organizerId, limit)

      const findManyCall = (prisma.event.findMany as jest.Mock).mock.calls[0]
      expect(findManyCall[0].take).toBe(limit)
    })

    it('should use default limit of 10 when not specified', async () => {
      const organizerId = 'organizer1'

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])

      await AnalyticsService.getTopSellingEvents(organizerId)

      const findManyCall = (prisma.event.findMany as jest.Mock).mock.calls[0]
      expect(findManyCall[0].take).toBe(10)
    })

    it('should filter only approved orders', async () => {
      const organizerId = 'organizer1'

      const mockEvents = [
        {
          id: 'event1',
          title: 'Evento A',
          orders: [
            {
              totalAmount: 1000,
              tickets: [{}, {}]
            }
          ]
        }
      ]

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue(mockEvents as any)

      await AnalyticsService.getTopSellingEvents(organizerId, 10)

      const findManyCall = (prisma.event.findMany as jest.Mock).mock.calls[0]
      expect(findManyCall[0].include.orders.where.paymentStatus).toBe('APPROVED')
    })

    it('should return empty array when organizer has no events', async () => {
      ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])

      const result = await AnalyticsService.getTopSellingEvents('organizer1', 10)

      expect(result).toEqual([])
    })

    it('should handle events with only pending/rejected orders', async () => {
      const mockEvents = [
        {
          id: 'event1',
          title: 'Evento A',
          orders: [] // No approved orders (pending/rejected filtered out)
        }
      ]

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue(mockEvents as any)

      const result = await AnalyticsService.getTopSellingEvents('organizer1', 10)

      expect(result[0]).toEqual({
        id: 'event1',
        title: 'Evento A',
        totalRevenue: 0,
        totalTickets: 0,
        totalOrders: 0
      })
    })
  })

  describe('Cross-Method Integration', () => {
    it('should maintain consistency between current and previous period summaries', async () => {
      const organizerId = 'organizer1'
      const eventId = 'event1'
      const days = 30

      // Mock current period orders
      const currentOrders = [
        {
          totalAmount: 1000,
          tickets: [{}, {}, {}]
        }
      ]

      // Mock previous period orders
      const previousOrders = [
        {
          totalAmount: 800,
          tickets: [{}, {}]
        }
      ]

      // First call is for current period, second is for previous period
      ;(prisma.order.findMany as jest.Mock)
        .mockResolvedValueOnce(currentOrders as any)
        .mockResolvedValueOnce(previousOrders as any)

      const currentSummary = await AnalyticsService.getOrganizerSalesSummary(
        organizerId,
        eventId
      )

      const previousSummary = await AnalyticsService.getPreviousPeriodSummary(
        organizerId,
        eventId,
        days
      )

      // Current period: 1000 revenue, 3 tickets, 1 order
      expect(currentSummary.totalRevenue).toBe(1000)
      expect(currentSummary.totalTicketsSold).toBe(3)
      expect(currentSummary.totalOrders).toBe(1)

      // Previous period: 800 revenue, 2 tickets, 1 order
      expect(previousSummary.totalRevenue).toBe(800)
      expect(previousSummary.totalTicketsSold).toBe(2)
      expect(previousSummary.totalOrders).toBe(1)

      // Growth can be calculated from these summaries
      const revenueGrowth = currentSummary.totalRevenue - previousSummary.totalRevenue
      expect(revenueGrowth).toBe(200)
    })

    it('should correlate top events with overall summary', async () => {
      const organizerId = 'organizer1'

      // Mock events
      const mockEvents = [
        {
          id: 'event1',
          title: 'Top Event',
          orders: [
            { totalAmount: 5000, tickets: [{}, {}, {}, {}, {}] },
            { totalAmount: 3000, tickets: [{}, {}, {}] }
          ]
        },
        {
          id: 'event2',
          title: 'Second Event',
          orders: [
            { totalAmount: 2000, tickets: [{}, {}] }
          ]
        }
      ]

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue(mockEvents as any)

      const topEvents = await AnalyticsService.getTopSellingEvents(organizerId, 10)

      // Sum of top events should match expected totals
      const totalRevenue = topEvents.reduce((sum, event) => sum + event.totalRevenue, 0)
      const totalTickets = topEvents.reduce((sum, event) => sum + event.totalTickets, 0)
      const totalOrders = topEvents.reduce((sum, event) => sum + event.totalOrders, 0)

      expect(totalRevenue).toBe(10000) // 5000 + 3000 + 2000
      expect(totalTickets).toBe(10) // 5 + 3 + 2
      expect(totalOrders).toBe(3)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large day values', async () => {
      const organizerId = 'organizer1'
      const days = 365 // 1 year

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])

      const result = await AnalyticsService.getPreviousPeriodSummary(
        organizerId,
        undefined,
        days
      )

      expect(result).toBeDefined()
      expect(result.totalRevenue).toBe(0)
    })

    it('should handle single day period', async () => {
      const organizerId = 'organizer1'
      const days = 1

      const mockOrders = [
        {
          totalAmount: 100,
          tickets: [{}]
        }
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders as any)

      const result = await AnalyticsService.getPreviousPeriodSummary(
        organizerId,
        undefined,
        days
      )

      expect(result.totalRevenue).toBe(100)
    })

    it('should handle events with large number of orders', async () => {
      const organizerId = 'organizer1'

      // Create 100 orders
      const manyOrders = Array.from({ length: 100 }, (_, i) => ({
        totalAmount: 50,
        tickets: [{}]
      }))

      const mockEvents = [
        {
          id: 'event1',
          title: 'Popular Event',
          orders: manyOrders
        }
      ]

      ;(prisma.event.findMany as jest.Mock).mockResolvedValue(mockEvents as any)

      const result = await AnalyticsService.getTopSellingEvents(organizerId, 10)

      expect(result[0].totalOrders).toBe(100)
      expect(result[0].totalRevenue).toBe(5000) // 100 * 50
      expect(result[0].totalTickets).toBe(100)
    })
  })
})
