import { LotService } from '@/lib/services/lot-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
    },
    lot: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
    },
  },
}))

describe('LotService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.LOT_UNSOLD_BEHAVIOR
  })

  afterEach(() => {
    delete process.env.LOT_UNSOLD_BEHAVIOR
  })

  const mockEvent = {
    id: 'event-id',
    organizerId: 'organizer-id',
    lots: [
      {
        id: 'lot-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-15'),
        totalQuantity: 100,
        isActive: true,
      },
      {
        id: 'lot-2',
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-02-15'),
        totalQuantity: 100,
        isActive: false,
      },
    ],
  }

  describe('with LOT_UNSOLD_BEHAVIOR=expire (default)', () => {
    it('should deactivate expired lot and activate next lot without rolling over unsold tickets', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(60) // 60 sold, 40 unsold

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return mockEvent.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.lotsUpdated).toBe(2)
      expect(result.ticketsRolledOver).toBe(0)

      // Verify lot-1 was deactivated
      expect(updates[0]).toEqual({
        where: { id: 'lot-1' },
        data: { isActive: false },
      })

      // Verify lot-2 was activated without capacity increment
      expect(updates[1]).toEqual({
        where: { id: 'lot-2' },
        data: { isActive: true },
      })
      expect(updates[1].data.totalQuantity).toBeUndefined()
    })

    it('should handle expired lot with no unsold tickets', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(100) // All sold out

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return mockEvent.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.lotsUpdated).toBe(2)
      expect(result.ticketsRolledOver).toBe(0)
    })
  })

  describe('with LOT_UNSOLD_BEHAVIOR=expire (explicit)', () => {
    beforeEach(() => {
      process.env.LOT_UNSOLD_BEHAVIOR = 'expire'
    })

    it('should respect expire setting when explicitly set', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(60) // 60 sold, 40 unsold

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return mockEvent.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.ticketsRolledOver).toBe(0)
      expect(updates[1].data.totalQuantity).toBeUndefined()
    })
  })

  describe('with LOT_UNSOLD_BEHAVIOR=rollover', () => {
    beforeEach(() => {
      process.env.LOT_UNSOLD_BEHAVIOR = 'rollover'
    })

    it('should deactivate expired lot and roll over unsold tickets to next lot', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(60) // 60 sold, 40 unsold

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return mockEvent.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.lotsUpdated).toBe(2)
      expect(result.ticketsRolledOver).toBe(40)

      // Verify lot-1 was deactivated
      expect(updates[0]).toEqual({
        where: { id: 'lot-1' },
        data: { isActive: false },
      })

      // Verify lot-2 was activated with capacity increment
      expect(updates[1].where).toEqual({ id: 'lot-2' })
      expect(updates[1].data.isActive).toBe(true)
      expect(updates[1].data.totalQuantity).toEqual({ increment: 40 })
    })

    it('should not roll over tickets when lot is completely sold out', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(100) // All sold out

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return mockEvent.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.lotsUpdated).toBe(2)
      expect(result.ticketsRolledOver).toBe(0)

      // Verify lot-2 was activated without capacity increment
      expect(updates[1].data.totalQuantity).toBeUndefined()
    })

    it('should handle multiple lots with unsold tickets', async () => {

      const eventWithMultipleLots = {
        ...mockEvent,
        lots: [
          {
            id: 'lot-1',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-15'),
            totalQuantity: 100,
            isActive: false,
          },
          {
            id: 'lot-2',
            startDate: new Date('2024-01-16'),
            endDate: new Date('2024-01-31'),
            totalQuantity: 100,
            isActive: true,
          },
          {
            id: 'lot-3',
            startDate: new Date('2024-02-01'),
            endDate: new Date('2024-02-15'),
            totalQuantity: 100,
            isActive: false,
          },
        ],
      }

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(eventWithMultipleLots)
      ; (prisma.ticket.count as jest.Mock).mockImplementation(({ where }) => {
        if (where.lotId === 'lot-2') return Promise.resolve(70) // 70 sold, 30 unsold
        return Promise.resolve(0)
      })

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return eventWithMultipleLots.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-02-05')) // After lot-2 expires

      expect(result.ticketsRolledOver).toBe(30)
    })

    it('should handle zero unsold tickets correctly', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(100) // All sold

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return mockEvent.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.ticketsRolledOver).toBe(0)
      expect(updates[1].data.totalQuantity).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should throw error when event is not found', async () => {
      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(LotService.rotateLots('non-existent-id')).rejects.toThrow('Evento não encontrado')
    })

    it('should not update lots when no lots are expired', async () => {
      // Create fresh mock data
      const freshMockEvent = {
        id: 'event-id',
        organizerId: 'organizer-id',
        lots: [
          {
            id: 'lot-1',
            startDate: new Date('2024-01-01T00:00:00Z'),
            endDate: new Date('2024-01-15T23:59:59Z'),
            totalQuantity: 100,
            isActive: true,
          },
          {
            id: 'lot-2',
            startDate: new Date('2024-01-20T00:00:00Z'),
            endDate: new Date('2024-02-15T23:59:59Z'),
            totalQuantity: 100,
            isActive: false,
          },
        ],
      }

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(freshMockEvent)

      const result = await LotService.rotateLots('event-id', new Date('2024-01-10'))

      expect(result.lotsUpdated).toBe(0)
      expect(result.ticketsRolledOver).toBe(0)
      expect(prisma.lot.update).not.toHaveBeenCalled()
    })

    it('should handle event with no lots', async () => {

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue({
        ...mockEvent,
        lots: [],
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-01-20'))

      expect(result.lotsUpdated).toBe(0)
      expect(result.ticketsRolledOver).toBe(0)
    })

    it('should handle expired lot with no next lot available', async () => {

      const eventWithLastLot = {
        ...mockEvent,
        lots: [
          {
            id: 'lot-1',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            totalQuantity: 100,
            isActive: true,
          },
        ],
      }

      ; (prisma.event.findUnique as jest.Mock).mockResolvedValue(eventWithLastLot)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(50)

      const updates: any[] = []
      ; (prisma.lot.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        updates.push({ where, data })
        return eventWithLastLot.lots.find((l: any) => l.id === where.id)
      })

      const result = await LotService.rotateLots('event-id', new Date('2024-02-05')) // After lot-1 expires

      expect(result.lotsUpdated).toBe(1) // Only deactivation
      expect(result.ticketsRolledOver).toBe(0)
      expect(updates.length).toBe(1)
      expect(updates[0].data.isActive).toBe(false)
    })
  })

  describe('calculateUnsoldTickets', () => {
    it('should calculate unsold tickets correctly', async () => {
      const mockLot = {
        id: 'lot-1',
        totalQuantity: 100,
      }

      ; (prisma.lot.findUnique as jest.Mock).mockResolvedValue(mockLot)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(60)

      const unsold = await LotService.calculateUnsoldTickets('lot-1')

      expect(unsold).toBe(40)
      expect(prisma.lot.findUnique).toHaveBeenCalledWith({
        where: { id: 'lot-1' },
      })
      expect(prisma.ticket.count).toHaveBeenCalledWith({
        where: {
          lotId: 'lot-1',
          order: {
            paymentStatus: { in: ['APPROVED', 'PENDING'] },
          },
        },
      })
    })

    it('should throw error when lot is not found', async () => {
      ; (prisma.lot.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(LotService.calculateUnsoldTickets('non-existent-lot')).rejects.toThrow('Lote não encontrado')
    })

    it('should handle fully sold lot', async () => {
      const mockLot = {
        id: 'lot-1',
        totalQuantity: 100,
      }

      ; (prisma.lot.findUnique as jest.Mock).mockResolvedValue(mockLot)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(100)

      const unsold = await LotService.calculateUnsoldTickets('lot-1')

      expect(unsold).toBe(0)
    })

    it('should handle completely unsold lot', async () => {
      const mockLot = {
        id: 'lot-1',
        totalQuantity: 100,
      }

      ; (prisma.lot.findUnique as jest.Mock).mockResolvedValue(mockLot)
      ; (prisma.ticket.count as jest.Mock).mockResolvedValue(0)

      const unsold = await LotService.calculateUnsoldTickets('lot-1')

      expect(unsold).toBe(100)
    })
  })
})
