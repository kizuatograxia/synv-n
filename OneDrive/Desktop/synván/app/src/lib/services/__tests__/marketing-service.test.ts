import { MarketingService, IntegrationType } from '@/lib/services/marketing-service'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/logger'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
    integrationConfig: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  __esModule: true,
  default: {},
}))

describe('MarketingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('configureIntegration', () => {
    it('should create new integration config', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.integrationConfig.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.integrationConfig.create as jest.Mock).mockResolvedValue({
        id: 'int1',
      })

      const result = await MarketingService.configureIntegration('user1', 'event1', {
        type: IntegrationType.FACEBOOK_PIXEL,
        enabled: true,
      })

      expect(result).toEqual({ id: 'int1' })
      expect(prisma.integrationConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: IntegrationType.FACEBOOK_PIXEL,
          enabled: true,
          eventId: 'event1',
        }),
      })
    })

    it('should throw error for non-organizer', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user2',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)

      await expect(
        MarketingService.configureIntegration('user1', 'event1', {
          type: IntegrationType.FACEBOOK_PIXEL,
          enabled: true,
        })
      ).rejects.toThrow('Sem permissão para configurar integrações')
    })
  })

  describe('getIntegrations', () => {
    it('should return integrations for event', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockIntegrations = [
        {
          id: 'int1',
          type: IntegrationType.FACEBOOK_PIXEL,
          enabled: true,
        },
      ]

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.integrationConfig.findMany as jest.Mock).mockResolvedValue(
        mockIntegrations
      )

      const result = await MarketingService.getIntegrations('event1', 'user1')

      expect(result).toEqual(mockIntegrations)
    })
  })

  describe('trackPurchase', () => {
    it('should track purchase with enabled integrations', async () => {
      const mockOrder = {
        id: 'order1',
        eventId: 'event1',
        totalAmount: 100,
        event: { title: 'Test Event' },
        user: { email: 'user@example.com', name: 'John Doe' },
        tickets: [
          { id: 'ticket1', type: 'GENERAL', price: 50 },
        ],
      }

      const mockIntegrations = [
        {
          id: 'int1',
          type: IntegrationType.FACEBOOK_PIXEL,
          enabled: true,
          apiKey: 'fb-key-123',
        },
        {
          id: 'int2',
          type: IntegrationType.GOOGLE_ANALYTICS,
          enabled: true,
          apiKey: 'ga-key-123',
        },
      ]

      ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
      ;(prisma.integrationConfig.findMany as jest.Mock).mockResolvedValue(
        mockIntegrations
      )

      const result = await MarketingService.trackPurchase('order1')

      expect(result).toEqual({
        facebookPixel: true,
        googleAnalytics: true,
        rdStation: false,
        hubspot: false,
      })

      expect(logger.debug).toHaveBeenCalledWith(
        '[Facebook Pixel] Tracking PURCHASE for event event1',
        expect.any(Object)
      )

      expect(logger.debug).toHaveBeenCalledWith(
        '[Google Analytics] Tracking purchase for event event1',
        expect.any(Object)
      )
    })
  })

  describe('disableIntegration', () => {
    it('should disable integration', async () => {
      const mockIntegration = {
        id: 'int1',
        type: IntegrationType.FACEBOOK_PIXEL,
        enabled: true,
        event: { organizerId: 'user1' },
      }

      ;(prisma.integrationConfig.findUnique as jest.Mock).mockResolvedValue(mockIntegration)
      ;(prisma.integrationConfig.update as jest.Mock).mockResolvedValue({
        id: 'int1',
        enabled: false,
      })

      const result = await MarketingService.disableIntegration('int1', 'user1')

      expect(result).toEqual({ id: 'int1', enabled: false })
      expect(prisma.integrationConfig.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { enabled: false },
      })
    })
  })

  describe('getIntegrationStats', () => {
    it('should return integration statistics', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockIntegrations = [
        {
          id: 'int1',
          type: IntegrationType.FACEBOOK_PIXEL,
          enabled: true,
        },
      ]

      const mockOrders = [
        { id: 'order1' },
        { id: 'order2' },
      ]

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.integrationConfig.findMany as jest.Mock).mockResolvedValue(
        mockIntegrations
      )
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders)

      const result = await MarketingService.getIntegrationStats('event1', 'user1')

      expect(result.totalOrders).toBe(2)
      expect(result.integrations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: IntegrationType.FACEBOOK_PIXEL,
            enabled: true,
          }),
        ])
      )
    })
  })
})
