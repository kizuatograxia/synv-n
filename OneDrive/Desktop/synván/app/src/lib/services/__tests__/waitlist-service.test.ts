import { WaitlistService } from '@/lib/services/waitlist-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
    lot: {
      find: jest.fn(),
    },
    waitlistEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

describe('WaitlistService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('joinWaitlist', () => {
    it('should add user to event waitlist', async () => {
      const mockEvent = {
        id: 'event1',
        lots: [],
      }

      const mockEntry = {
        id: 'wl1',
        userId: 'user1',
        eventId: 'event1',
        position: 1,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.waitlistEntry.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.waitlistEntry.create as jest.Mock).mockResolvedValue(mockEntry)

      const result = await WaitlistService.joinWaitlist('user1', {
        eventId: 'event1',
      })

      expect(result).toEqual(mockEntry)
    })

    it('should throw error if user already on waitlist', async () => {
      const mockEvent = {
        id: 'event1',
        lots: [],
      }

      const existingEntry = {
        id: 'wl1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue(
        existingEntry
      )

      await expect(
        WaitlistService.joinWaitlist('user1', { eventId: 'event1' })
      ).rejects.toThrow('Você já está na lista de espera')
    })

    it('should throw error if tickets available', async () => {
      const mockEvent = {
        id: 'event1',
        lots: [{ availableQuantity: 10 }],
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)

      await expect(
        WaitlistService.joinWaitlist('user1', { eventId: 'event1' })
      ).rejects.toThrow('Este evento ainda tem ingressos disponíveis')
    })
  })

  describe('getWaitlistEntries', () => {
    it('should return waitlist entries for event organizer', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      const mockEntries = [
        {
          id: 'wl1',
          userId: 'user2',
          eventId: 'event1',
          position: 1,
          user: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      ]

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.waitlistEntry.findMany as jest.Mock).mockResolvedValue(
        mockEntries
      )

      const result = await WaitlistService.getWaitlistEntries('event1', 'user1')

      expect(result).toEqual(mockEntries)
    })
  })

  describe('getWaitlistAnalytics', () => {
    it('should return waitlist analytics', async () => {
      const mockEvent = {
        id: 'event1',
        organizerId: 'user1',
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(prisma.waitlistEntry.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(50)
      ;(prisma.waitlistEntry.groupBy as jest.Mock).mockResolvedValue([
        { lotId: null, _count: 50 },
      ])
      ;(prisma.waitlistEntry.groupBy as jest.Mock).mockResolvedValue([
        { lotId: null, _count: 50 },
      ])

      const result = await WaitlistService.getWaitlistAnalytics('event1', 'user1')

      expect(result.totalWaitlisted).toBe(50)
      expect(result.notifiedCount).toBe(50)
    })
  })

  describe('leaveWaitlist', () => {
    it('should remove user from waitlist', async () => {
      const mockEntry = {
        id: 'wl1',
      }

      ;(prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue(mockEntry)
      ;(prisma.waitlistEntry.delete as jest.Mock).mockResolvedValue({})

      const result = await WaitlistService.leaveWaitlist('user1', 'event1')

      expect(result).toEqual({ success: true })
      expect(prisma.waitlistEntry.delete).toHaveBeenCalledWith({
        where: { id: 'wl1' },
      })
    })

    it('should throw error if user not on waitlist', async () => {
      ;(prisma.waitlistEntry.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(
        WaitlistService.leaveWaitlist('user1', 'event1')
      ).rejects.toThrow('Você não está na lista de espera')
    })
  })

  describe('notifyWaitlist', () => {
    it('should notify waitlisted users', async () => {
      const mockEntries = [
        { id: 'wl1', user: { email: 'user1@example.com' } },
        { id: 'wl2', user: { email: 'user2@example.com' } },
      ]

      ;(prisma.waitlistEntry.findMany as jest.Mock).mockResolvedValue(mockEntries)
      ;(prisma.waitlistEntry.updateMany as jest.Mock).mockResolvedValue({})

      const result = await WaitlistService.notifyWaitlist('event1')

      expect(result.notified).toBe(2)
      expect(prisma.waitlistEntry.updateMany).toHaveBeenCalled()
    })
  })
})
