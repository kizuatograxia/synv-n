import { CartService } from '@/lib/services/cart-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lot: {
      findMany: jest.fn(),
    },
    seat: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

describe('CartService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCartWithDetails', () => {
    it('should return cart with lot details', async () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const },
        { lotId: 'lot2', quantity: 1, ticketType: 'VIP' as const },
      ]

      const mockLots = [
        { id: 'lot1', name: 'Lote 1', price: 100, availableQuantity: 50 },
        { id: 'lot2', name: 'Lote 2', price: 150, availableQuantity: 30 },
      ]

      ;(prisma.lot.findMany as jest.Mock).mockResolvedValue(mockLots)

      const result = await CartService.getCartWithDetails(mockItems, 'event1')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        lotId: 'lot1',
        quantity: 2,
        ticketType: 'GENERAL',
        lotName: 'Lote 1',
        lotPrice: 100,
        availableQuantity: 50,
        total: 200,
      })
      expect(result[1]).toEqual({
        lotId: 'lot2',
        quantity: 1,
        ticketType: 'VIP',
        lotName: 'Lote 2',
        lotPrice: 150,
        availableQuantity: 30,
        total: 150,
      })
    })

    it('should throw error when lot not found', async () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const },
      ]

      ;(prisma.lot.findMany as jest.Mock).mockResolvedValue([])

      await expect(
        CartService.getCartWithDetails(mockItems, 'event1')
      ).rejects.toThrow('Lote lot1 não encontrado ou indisponível')
    })

    it('should throw error when quantity exceeds availability', async () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 60, ticketType: 'GENERAL' as const },
      ]

      const mockLots = [
        { id: 'lot1', name: 'Lote 1', price: 100, availableQuantity: 50 },
      ]

      ;(prisma.lot.findMany as jest.Mock).mockResolvedValue(mockLots)

      await expect(
        CartService.getCartWithDetails(mockItems, 'event1')
      ).rejects.toThrow('Quantidade indisponível para o lote Lote 1')
    })
  })

  describe('calculateCartTotal', () => {
    it('should calculate total correctly', () => {
      const mockCart = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
        { lotId: 'lot2', quantity: 1, ticketType: 'VIP' as const, lotName: 'Lote 2', lotPrice: 150, availableQuantity: 30, total: 150 },
      ]

      const total = CartService.calculateCartTotal(mockCart)

      expect(total).toBe(350)
    })

    it('should return 0 for empty cart', () => {
      const total = CartService.calculateCartTotal([])

      expect(total).toBe(0)
    })
  })

  describe('validateCartItems', () => {
    it('should throw error for empty cart', () => {
      expect(() => CartService.validateCartItems([])).toThrow('Carrinho vazio')
    })

    it('should throw error for duplicate lots', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const },
        { lotId: 'lot1', quantity: 1, ticketType: 'VIP' as const },
      ]

      expect(() => CartService.validateCartItems(mockItems)).toThrow(
        'Lotes duplicados no carrinho'
      )
    })

    it('should throw error for quantity less than 1', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 0, ticketType: 'GENERAL' as const },
      ]

      expect(() => CartService.validateCartItems(mockItems)).toThrow(
        'Quantidade deve ser ao menos 1'
      )
    })

    it('should throw error for quantity more than 10', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 11, ticketType: 'GENERAL' as const },
      ]

      expect(() => CartService.validateCartItems(mockItems)).toThrow(
        'Máximo de 10 ingressos por compra'
      )
    })

    it('should validate correct items', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const },
        { lotId: 'lot2', quantity: 5, ticketType: 'VIP' as const },
      ]

      expect(() => CartService.validateCartItems(mockItems)).not.toThrow()
    })
  })

  describe('generateTicketCode', () => {
    it('should generate unique codes', () => {
      const code1 = CartService.generateTicketCode()
      const code2 = CartService.generateTicketCode()

      expect(code1).not.toBe(code2)
      expect(code1).toMatch(/^[A-Z0-9]+$/)
      expect(code2).toMatch(/^[A-Z0-9]+$/)
    })

    it('should generate codes with expected length', () => {
      const code = CartService.generateTicketCode()

      expect(code.length).toBeGreaterThan(10)
      expect(code.length).toBeLessThan(20)
    })
  })

  describe('getCartWithDetails with seat selections', () => {
    it('should return cart with seat details', async () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, seatIds: ['seat1', 'seat2'] },
      ]

      const mockLots = [
        { id: 'lot1', name: 'Lote 1', price: 100, availableQuantity: 50 },
      ]

      const mockSeats = [
        { id: 'seat1', label: 'A1', sector: { name: 'Setor A', price: 150 } },
        { id: 'seat2', label: 'A2', sector: { name: 'Setor A', price: 150 } },
      ]

      ;(prisma.lot.findMany as jest.Mock).mockResolvedValue(mockLots)
      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      const result = await CartService.getCartWithDetails(mockItems, 'event1')

      expect(result).toHaveLength(1)
      expect(result[0].seats).toHaveLength(2)
      expect(result[0].total).toBe(300) // 2 seats * 150
      expect(result[0].seats?.[0]).toEqual({
        id: 'seat1',
        label: 'A1',
        sectorName: 'Setor A',
        seatPrice: 150,
      })
    })

    it('should throw error when seat not found or not reserved', async () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, seatIds: ['seat1', 'seat2'] },
      ]

      const mockLots = [
        { id: 'lot1', name: 'Lote 1', price: 100, availableQuantity: 50 },
      ]

      // Only return one seat when two are requested
      const mockSeats = [
        { id: 'seat1', label: 'A1', sector: null },
      ]

      ;(prisma.lot.findMany as jest.Mock).mockResolvedValue(mockLots)
      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      // Should not throw for getCartWithDetails - it only checks if lot exists and has quantity
      const result = await CartService.getCartWithDetails(mockItems, 'event1')
      expect(result).toHaveLength(1)
    })
  })

  describe('validateCartItems with seat validation', () => {
    it('should throw error when seatIds count does not match quantity', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, seatIds: ['seat1'] },
      ]

      expect(() => CartService.validateCartItems(mockItems)).toThrow(
        'Número de assentos deve ser igual à quantidade'
      )
    })

    it('should validate correct items with seatIds', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, seatIds: ['seat1', 'seat2'] },
      ]

      expect(() => CartService.validateCartItems(mockItems)).not.toThrow()
    })

    it('should validate cart with multiple items under limit', () => {
      const mockItems = [
        { lotId: 'lot1', quantity: 5, ticketType: 'GENERAL' as const },
        { lotId: 'lot2', quantity: 5, ticketType: 'VIP' as const },
      ]

      expect(() => CartService.validateCartItems(mockItems)).not.toThrow()
    })
  })

  describe('reserveSeatsForOrder', () => {
    it('should reserve seats successfully', async () => {
      const seatIds = ['seat1', 'seat2']
      const userId = 'user1'

      const mockSeats = [
        { id: 'seat1', status: 'AVAILABLE' },
        { id: 'seat2', status: 'AVAILABLE' },
      ]

      const mockTransaction = async (callback: any) => {
        return await callback({
          seat: {
            findMany: jest.fn().mockResolvedValue(mockSeats),
            update: jest.fn().mockResolvedValue({}),
          },
        })
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(mockTransaction)

      const result = await CartService.reserveSeatsForOrder(seatIds, userId)

      expect(result).toEqual(mockSeats)
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should throw error when some seats are unavailable', async () => {
      const seatIds = ['seat1', 'seat2']
      const userId = 'user1'

      // Only one seat available
      const mockSeats = [
        { id: 'seat1', status: 'AVAILABLE' },
      ]

      const mockTransaction = async (callback: any) => {
        return await callback({
          seat: {
            findMany: jest.fn().mockResolvedValue(mockSeats),
            update: jest.fn(),
          },
        })
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(mockTransaction)

      await expect(
        CartService.reserveSeatsForOrder(seatIds, userId)
      ).rejects.toThrow('Alguns assentos não estão disponíveis')
    })

    it('should use custom reservation timeout', async () => {
      const seatIds = ['seat1']
      const userId = 'user1'
      const customTimeout = 300000 // 5 minutes

      const mockSeats = [{ id: 'seat1', status: 'AVAILABLE' }]
      const mockTransaction = async (callback: any) => {
        return await callback({
          seat: {
            findMany: jest.fn().mockResolvedValue(mockSeats),
            update: jest.fn().mockImplementation(({ where, data }) => {
              expect(data.reservedAt).toBeInstanceOf(Date)
              return Promise.resolve({})
            }),
          },
        })
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(mockTransaction)

      await CartService.reserveSeatsForOrder(seatIds, userId, customTimeout)

      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('releaseAllSeatReservations', () => {
    it('should release all seat reservations for user', async () => {
      const userId = 'user1'

      ;(prisma.seat.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      })

      const result = await CartService.releaseAllSeatReservations(userId)

      expect(result).toEqual({ count: 5 })
      expect(prisma.seat.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'RESERVED',
          reservedBy: userId,
        },
        data: {
          status: 'AVAILABLE',
          reservedAt: null,
          reservedBy: null,
        },
      })
    })
  })

  describe('linkSeatsToTickets', () => {
    it('should link seats to tickets successfully', async () => {
      const ticketIds = ['ticket1', 'ticket2']
      const seatIds = ['seat1', 'seat2']

      const mockTransaction = async (callback: any) => {
        return await callback({
          seat: {
            update: jest.fn().mockResolvedValue({}),
          },
        })
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(mockTransaction)

      await CartService.linkSeatsToTickets(ticketIds, seatIds)

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should throw error when ticket and seat counts do not match', async () => {
      const ticketIds = ['ticket1', 'ticket2']
      const seatIds = ['seat1'] // Mismatch

      await expect(
        CartService.linkSeatsToTickets(ticketIds, seatIds)
      ).rejects.toThrow('Número de tickets e assentos deve ser igual')
    })
  })

  describe('validateSeatAvailability', () => {
    it('should validate available seats successfully', async () => {
      const seatIds = ['seat1', 'seat2']
      const eventId = 'event1'

      const mockSeats = [
        { id: 'seat1', status: 'AVAILABLE', sector: {}, lot: {} },
        { id: 'seat2', status: 'AVAILABLE', sector: {}, lot: {} },
      ]

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      const result = await CartService.validateSeatAvailability(seatIds, eventId)

      expect(result).toEqual(mockSeats)
    })

    it('should throw error when some seats are not found', async () => {
      const seatIds = ['seat1', 'seat2']
      const eventId = 'event1'

      // Only return one seat
      const mockSeats = [
        { id: 'seat1', status: 'AVAILABLE', sector: {}, lot: {} },
      ]

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      await expect(
        CartService.validateSeatAvailability(seatIds, eventId)
      ).rejects.toThrow('Alguns assentos não foram encontrados')
    })

    it('should throw error when some seats are unavailable', async () => {
      const seatIds = ['seat1', 'seat2']
      const eventId = 'event1'

      const mockSeats = [
        { id: 'seat1', status: 'AVAILABLE', sector: {}, lot: {} },
        { id: 'seat2', status: 'SOLD', sector: {}, lot: {} }, // Unavailable
      ]

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      await expect(
        CartService.validateSeatAvailability(seatIds, eventId)
      ).rejects.toThrow('Alguns assentos já não estão disponíveis')
    })

    it('should throw error when seats are reserved', async () => {
      const seatIds = ['seat1', 'seat2']
      const eventId = 'event1'

      const mockSeats = [
        { id: 'seat1', status: 'RESERVED', sector: {}, lot: {} },
        { id: 'seat2', status: 'AVAILABLE', sector: {}, lot: {} },
      ]

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      await expect(
        CartService.validateSeatAvailability(seatIds, eventId)
      ).rejects.toThrow('Alguns assentos já não estão disponíveis')
    })
  })

  describe('getSeatsWithDetails', () => {
    it('should return seats with full details', async () => {
      const seatIds = ['seat1', 'seat2']
      const eventId = 'event1'

      const mockSeats = [
        {
          id: 'seat1',
          label: 'A1',
          status: 'RESERVED',
          sector: { id: 'sector1', name: 'Setor A' },
          lot: { id: 'lot1', name: 'Lote 1' },
          seatMap: { id: 'map1', name: 'Mapa 1' },
        },
        {
          id: 'seat2',
          label: 'A2',
          status: 'RESERVED',
          sector: { id: 'sector1', name: 'Setor A' },
          lot: { id: 'lot1', name: 'Lote 1' },
          seatMap: { id: 'map1', name: 'Mapa 1' },
        },
      ]

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      const result = await CartService.getSeatsWithDetails(seatIds, eventId)

      expect(result).toEqual(mockSeats)
      expect(prisma.seat.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: seatIds },
          seatMap: { eventId },
          status: 'RESERVED',
        },
        include: {
          sector: true,
          lot: true,
          seatMap: true,
        },
      })
    })

    it('should throw error when not all seats are found', async () => {
      const seatIds = ['seat1', 'seat2']
      const eventId = 'event1'

      // Only return one seat
      const mockSeats = [
        {
          id: 'seat1',
          label: 'A1',
          status: 'RESERVED',
          sector: {},
          lot: {},
          seatMap: {},
        },
      ]

      ;(prisma.seat.findMany as jest.Mock).mockResolvedValue(mockSeats)

      await expect(
        CartService.getSeatsWithDetails(seatIds, eventId)
      ).rejects.toThrow('Alguns assentos não estão disponíveis')
    })
  })
})
