import { describe, it, expect, beforeEach } from '@jest/globals'
import { seatMapService } from '../seat-map-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    seatMap: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    seat: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn()
    },
    sector: {
      create: jest.fn()
    }
  }
}))

describe('SeatMapService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSeatMap', () => {
    it('should create a seat map with seats', async () => {
      const mockSeatMap = {
        id: 'seatMap1',
        name: 'Main Hall',
        rows: 5,
        columns: 10,
        aisleConfig: []
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma as any)
      })

      ;(prisma.seatMap.create as jest.Mock).mockResolvedValue(mockSeatMap as any)
      ;(prisma.seat.createMany as jest.Mock).mockResolvedValue({ count: 50 } as any)

      const result = await seatMapService.createSeatMap('event1', {
        name: 'Main Hall',
        rows: 5,
        columns: 10
      })

      expect(prisma.seatMap.create).toHaveBeenCalled()
      expect(prisma.seat.createMany).toHaveBeenCalled()
      expect(result.id).toBe('seatMap1')
    })

    it('should handle aisle configuration', async () => {
      const mockSeatMap = {
        id: 'seatMap1',
        name: 'Main Hall',
        rows: 5,
        columns: 10,
        aisleConfig: [[2, 5]]
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma as any)
      })

      ;(prisma.seatMap.create as jest.Mock).mockResolvedValue(mockSeatMap as any)
      ;(prisma.seat.createMany as jest.Mock).mockResolvedValue({ count: 49 } as any)

      const result = await seatMapService.createSeatMap('event1', {
        name: 'Main Hall',
        rows: 5,
        columns: 10,
        aisleConfig: [[2, 5]]
      })

      expect(result.id).toBe('seatMap1')
    })
  })

  describe('createSector', () => {
    it('should create a sector and assign seats', async () => {
      const mockSector = {
        id: 'sector1',
        name: 'VIP',
        color: '#FF0000',
        price: 150,
        rowStart: 0,
        rowEnd: 2,
        colStart: 0,
        colEnd: 5
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma as any)
      })

      ;(prisma.sector.create as jest.Mock).mockResolvedValue(mockSector as any)
      ;(prisma.seat.updateMany as jest.Mock).mockResolvedValue({ count: 18 } as any)

      const result = await seatMapService.createSector('seatMap1', {
        name: 'VIP',
        color: '#FF0000',
        price: 150,
        rowStart: 0,
        rowEnd: 2,
        colStart: 0,
        colEnd: 5
      })

      expect(prisma.sector.create).toHaveBeenCalled()
      expect(prisma.seat.updateMany).toHaveBeenCalled()
      expect(result.id).toBe('sector1')
    })
  })

  describe('getSeatMap', () => {
    it('should return seat map with all related data', async () => {
      const mockSeatMap = {
        id: 'seatMap1',
        name: 'Main Hall',
        rows: 5,
        columns: 10,
        sectors: [],
        seats: []
      }

      ;(prisma.seatMap.findUnique as jest.Mock).mockResolvedValue(mockSeatMap as any)

      const result = await seatMapService.getSeatMap('seatMap1')

      expect(prisma.seatMap.findUnique).toHaveBeenCalledWith({
        where: { id: 'seatMap1' },
        include: expect.any(Object)
      })
      expect(result).toBeDefined()
    })
  })

  describe('getEventSeatMaps', () => {
    it('should return all seat maps for an event', async () => {
      const mockSeatMaps = [
        { id: 'seatMap1', name: 'Session 1', _count: { seats: 50 } },
        { id: 'seatMap2', name: 'Session 2', _count: { seats: 50 } }
      ]

      ;(prisma.seatMap.findMany as jest.Mock).mockResolvedValue(mockSeatMaps as any)

      const result = await seatMapService.getEventSeatMaps('event1')

      expect(prisma.seatMap.findMany).toHaveBeenCalledWith({
        where: { eventId: 'event1' },
        include: expect.any(Object)
      })
      expect(result).toHaveLength(2)
    })
  })

  describe('reserveSeats', () => {
    it('should reserve available seats', async () => {
      const mockSeats = [
        { id: 'seat1', row: 0, column: 0, status: 'AVAILABLE' },
        { id: 'seat2', row: 0, column: 1, status: 'AVAILABLE' }
      ]

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma as any)
      })

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats as any)
      ;(prisma.seat.update as jest.Mock).mockImplementation(async ({ where, data }) => {
        const seat = mockSeats.find((s: any) => s.id === where.id)
        return { ...seat, ...data } as any
      })

      const result = await seatMapService.reserveSeats('seatMap1', {
        userId: 'user1',
        seatIds: ['seat1', 'seat2']
      })

      expect(prisma.seat.findMany).toHaveBeenCalled()
      expect(prisma.seat.update).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
    })

    it('should throw error if seats are not available', async () => {
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma as any)
      })

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue([] as any)

      await expect(
        seatMapService.reserveSeats('seatMap1', {
          userId: 'user1',
          seatIds: ['seat1', 'seat2']
        })
      ).rejects.toThrow('Alguns assentos não estão disponíveis')
    })
  })

  describe('releaseReservations', () => {
    it('should release user reservations', async () => {
      ;(prisma.seat.updateMany as jest.Mock).mockResolvedValue({ count: 2 } as any)

      await seatMapService.releaseReservations('user1', ['seat1', 'seat2'])

      expect(prisma.seat.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['seat1', 'seat2'] },
          status: 'RESERVED',
          reservedBy: 'user1'
        },
        data: {
          status: 'AVAILABLE',
          reservedAt: null,
          reservedBy: null
        }
      })
    })
  })

  describe('confirmSeatReservations', () => {
    it('should confirm reservations and link tickets', async () => {
      const mockSeats = [
        { id: 'seat1', row: 0, column: 0 },
        { id: 'seat2', row: 0, column: 1 }
      ]

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prisma as any)
      })

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats as any)
      ;(prisma.seat.update as jest.Mock).mockResolvedValue({} as any)

      await seatMapService.confirmSeatReservations(
        ['seat1', 'seat2'],
        ['ticket1', 'ticket2']
      )

      expect(prisma.seat.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('releaseExpiredReservations', () => {
    it('should release expired reservations', async () => {
      ;(prisma.seat.updateMany as jest.Mock).mockResolvedValue({ count: 5 } as any)

      const result = await seatMapService.releaseExpiredReservations()

      expect(prisma.seat.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'RESERVED',
          reservedAt: {
            lt: expect.any(Date)
          }
        },
        data: {
          status: 'AVAILABLE',
          reservedAt: null,
          reservedBy: null
        }
      })
      expect(result).toBe(5)
    })
  })

  describe('deleteSeatMap', () => {
    it('should delete a seat map', async () => {
      const mockSeatMap = { id: 'seatMap1', name: 'Main Hall' }
      ;(prisma.seatMap.delete as jest.Mock).mockResolvedValue(mockSeatMap as any)

      const result = await seatMapService.deleteSeatMap('seatMap1')

      expect(prisma.seatMap.delete).toHaveBeenCalledWith({
        where: { id: 'seatMap1' }
      })
      expect(result).toBeDefined()
    })
  })

  describe('updateSeatMap', () => {
    it('should update seat map properties', async () => {
      const mockUpdatedSeatMap = { id: 'seatMap1', name: 'Updated Hall', rows: 6, columns: 12 }
      ;(prisma.seatMap.update as jest.Mock).mockResolvedValue(mockUpdatedSeatMap as any)

      const result = await seatMapService.updateSeatMap('seatMap1', {
        name: 'Updated Hall',
        rows: 6,
        columns: 12
      })

      expect(prisma.seatMap.update).toHaveBeenCalledWith({
        where: { id: 'seatMap1' },
        data: {
          name: 'Updated Hall',
          rows: 6,
          columns: 12
        }
      })
      expect(result).toBeDefined()
    })
  })
})
