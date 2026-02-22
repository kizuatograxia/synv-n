import { ResaleService } from '@/lib/services/resale-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    ticket: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    resaleListing: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    seat: {
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/qrcode/qrcode-service', () => ({
  QRCodeService: {
    generateUniqueCode: jest.fn(() => 'TEST123'),
  },
}))

describe('ResaleService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createResaleListing', () => {
    it('should create resale listing for valid ticket', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user1',
        price: 100,
        isUsed: false,
        eventId: 'event1',
        event: {
          id: 'event1',
          startTime: new Date(Date.now() + 86400000),
        },
        user: { id: 'user1' },
        resaleListing: null,
      }

      const mockListing = {
        id: 'listing1',
        resalePrice: 100,
        originalPrice: 100,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 2592000000),
        ticketId: 'ticket1',
        sellerId: 'user1',
        eventId: 'event1',
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)
      ;(prisma.resaleListing.create as jest.Mock).mockResolvedValue(mockListing)

      const result = await ResaleService.createResaleListing('user1', {
        ticketId: 'ticket1',
        resalePrice: 100,
      })

      expect(result).toEqual(mockListing)
      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: 'ticket1' },
        include: {
          event: true,
          user: true,
          resaleListing: true,
        },
      })
      expect(prisma.resaleListing.create).toHaveBeenCalledWith({
        data: {
          resalePrice: 100,
          originalPrice: 100,
          expiresAt: expect.any(Date),
          ticketId: 'ticket1',
          sellerId: 'user1',
          eventId: 'event1',
        },
      })
    })

    it('should throw error if ticket not owned by user', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user2',
        price: 100,
        isUsed: false,
        event: {
          id: 'event1',
          startTime: new Date(Date.now() + 86400000),
        },
        user: { id: 'user2' },
        resaleListing: null,
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)

      await expect(
        ResaleService.createResaleListing('user1', {
          ticketId: 'ticket1',
          resalePrice: 100,
        })
      ).rejects.toThrow('Apenas o proprietário pode listar o ingresso para revenda')
    })

    it('should throw error if ticket is used', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user1',
        price: 100,
        isUsed: true,
        event: {
          id: 'event1',
          startTime: new Date(Date.now() + 86400000),
        },
        user: { id: 'user1' },
        resaleListing: null,
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)

      await expect(
        ResaleService.createResaleListing('user1', {
          ticketId: 'ticket1',
          resalePrice: 100,
        })
      ).rejects.toThrow('Ingressos já utilizados não podem ser revendidos')
    })

    it('should throw error if resale price exceeds original', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user1',
        price: 100,
        isUsed: false,
        event: {
          id: 'event1',
          startTime: new Date(Date.now() + 86400000),
        },
        user: { id: 'user1' },
        resaleListing: null,
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)

      await expect(
        ResaleService.createResaleListing('user1', {
          ticketId: 'ticket1',
          resalePrice: 150,
        })
      ).rejects.toThrow('Preço de revenda não pode exceder')
    })

    it('should throw error if ticket already has resale listing', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user1',
        price: 100,
        isUsed: false,
        event: {
          id: 'event1',
          startTime: new Date(Date.now() + 86400000),
        },
        user: { id: 'user1' },
        resaleListing: { id: 'listing1' },
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)

      await expect(
        ResaleService.createResaleListing('user1', {
          ticketId: 'ticket1',
          resalePrice: 100,
        })
      ).rejects.toThrow('Este ingresso já está listado para revenda')
    })
  })

  describe('getResaleListings', () => {
    it('should get all active resale listings', async () => {
      const mockListings = [
        {
          id: 'listing1',
          resalePrice: 90,
          originalPrice: 100,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 2592000000),
          ticket: {
            id: 'ticket1',
            type: 'GENERAL',
            seat: null,
          },
          event: {
            id: 'event1',
            title: 'Test Event',
            startTime: new Date(Date.now() + 86400000),
            location: 'São Paulo',
            imageUrl: 'https://example.com/image.jpg',
          },
          seller: {
            id: 'user1',
            name: 'John Doe',
          },
        },
      ]

      ;(prisma.resaleListing.findMany as jest.Mock).mockResolvedValue(mockListings)

      const result = await ResaleService.getResaleListings()

      expect(result).toEqual(mockListings)
      expect(prisma.resaleListing.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          ticket: {
            include: {
              seat: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              startTime: true,
              location: true,
              imageUrl: true,
            },
          },
          seller: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })

    it('should filter listings by eventId', async () => {
      ;(prisma.resaleListing.findMany as jest.Mock).mockResolvedValue([])

      await ResaleService.getResaleListings({ eventId: 'event1' })

      expect(prisma.resaleListing.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          eventId: 'event1',
        }),
        include: expect.any(Object),
        orderBy: {
          createdAt: 'desc',
        },
      })
    })
  })

  describe('validateTicketForResale', () => {
    it('should validate ticket for resale', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user1',
        price: 100,
        isUsed: false,
        event: {
          id: 'event1',
          title: 'Test Event',
          startTime: new Date(Date.now() + 86400000),
        },
        resaleListing: null,
        checkins: [],
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)

      const result = await ResaleService.validateTicketForResale(
        'ticket1',
        'user1'
      )

      expect(result).toEqual({
        valid: true,
        originalPrice: 100,
        maxResalePrice: 100,
        eventTitle: 'Test Event',
        eventDate: expect.any(Date),
      })
    })

    it('should return invalid if ticket not found', async () => {
      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await ResaleService.validateTicketForResale('ticket1', 'user1')

      expect(result).toEqual({
        valid: false,
        reason: 'Ingresso não encontrado',
      })
    })

    it('should return invalid if ticket already used', async () => {
      const mockTicket = {
        id: 'ticket1',
        userId: 'user1',
        price: 100,
        isUsed: true,
        event: {
          id: 'event1',
          startTime: new Date(Date.now() + 86400000),
        },
        resaleListing: null,
        checkins: [],
      }

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket)

      const result = await ResaleService.validateTicketForResale('ticket1', 'user1')

      expect(result).toEqual({
        valid: false,
        reason: 'Ingresso já utilizado',
      })
    })
  })

  describe('cancelResaleListing', () => {
    it('should cancel resale listing', async () => {
      const mockListing = {
        id: 'listing1',
        sellerId: 'user1',
        status: 'ACTIVE',
      }

      const mockUpdatedListing = {
        ...mockListing,
        status: 'CANCELLED',
      }

      ;(prisma.resaleListing.findUnique as jest.Mock).mockResolvedValue(mockListing)
      ;(prisma.resaleListing.update as jest.Mock).mockResolvedValue(mockUpdatedListing)

      const result = await ResaleService.cancelResaleListing('listing1', 'user1')

      expect(result).toEqual(mockUpdatedListing)
      expect(prisma.resaleListing.update).toHaveBeenCalledWith({
        where: { id: 'listing1' },
        data: {
          status: 'CANCELLED',
        },
      })
    })

    it('should throw error if user is not the seller', async () => {
      const mockListing = {
        id: 'listing1',
        sellerId: 'user2',
        status: 'ACTIVE',
      }

      ;(prisma.resaleListing.findUnique as jest.Mock).mockResolvedValue(mockListing)

      await expect(
        ResaleService.cancelResaleListing('listing1', 'user1')
      ).rejects.toThrow('Apenas o vendedor pode cancelar a revenda')
    })
  })
})
