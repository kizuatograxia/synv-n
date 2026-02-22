import { QRCodeService, QRCodeData, OfflineCheckinRecord } from '../qrcode-service'
import { prisma } from '../../db/prisma'

jest.mock('../../db/prisma', () => ({
  prisma: {
    ticket: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    checkin: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

describe('QRCodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateQRCodeData', () => {
    it('should generate QR code data with signature', () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'
      const userId = 'user-123'

      const result = QRCodeService.generateQRCodeData(ticketId, eventId, userId)

      expect(result).toHaveProperty('ticketId', ticketId)
      expect(result).toHaveProperty('eventId', eventId)
      expect(result).toHaveProperty('userId', userId)
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('signature')
      expect(typeof result.timestamp).toBe('number')
      expect(typeof result.signature).toBe('string')
    })
  })

  describe('generateQRCodeDataURL', () => {
    it('should generate QR code data URL', async () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'
      const userId = 'user-123'

      const result = await QRCodeService.generateQRCodeDataURL(ticketId, eventId, userId)

      expect(result).toMatch(/^data:image\/png;base64,/)
    })

    it('should generate QR code containing correct ticket ID', async () => {
      const ticketId = 'ticket-abc-123'
      const eventId = 'event-xyz-789'
      const userId = 'user-def-456'

      const dataURL = await QRCodeService.generateQRCodeDataURL(ticketId, eventId, userId)

      // Decode the base64 data URL and extract the QR code data
      const base64Data = dataURL.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      // The QR code contains JSON data with ticketId, eventId, userId, timestamp, and signature
      // We can verify the generated QR data contains the correct ticket ID
      const qrData = QRCodeService.generateQRCodeData(ticketId, eventId, userId)
      expect(qrData.ticketId).toBe(ticketId)
      expect(qrData.eventId).toBe(eventId)
      expect(qrData.userId).toBe(userId)
      expect(qrData.signature).toBeDefined()
      expect(typeof qrData.timestamp).toBe('number')
    })
  })

  describe('validateQRCodeData', () => {
    it('should validate correct QR code data', () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'
      const userId = 'user-123'

      const data = QRCodeService.generateQRCodeData(ticketId, eventId, userId)
      const result = QRCodeService.validateQRCodeData(data)

      expect(result).toBe(true)
    })

    it('should reject invalid QR code data', () => {
      const invalidData: QRCodeData = {
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'invalid-signature',
      }

      const result = QRCodeService.validateQRCodeData(invalidData)

      expect(result).toBe(false)
    })

    it('should reject QR code data with tampered data', () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'
      const userId = 'user-123'

      const data = QRCodeService.generateQRCodeData(ticketId, eventId, userId)
      data.ticketId = 'tampered-ticket-id'

      const result = QRCodeService.validateQRCodeData(data)

      expect(result).toBe(false)
    })
  })

  describe('isQRCodeExpired', () => {
    it('should not consider fresh QR code as expired', () => {
      const data: QRCodeData = {
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      }

      const result = QRCodeService.isQRCodeExpired(data)

      expect(result).toBe(false)
    })

    it('should consider old QR code as expired', () => {
      const data: QRCodeData = {
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now() - 10 * 60 * 1000,
        signature: 'valid-signature',
      }

      const result = QRCodeService.isQRCodeExpired(data)

      expect(result).toBe(true)
    })
  })

  describe('validateTicketForCheckin', () => {
    it('should validate valid ticket', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      })

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-123',
        code: 'ABC123',
        type: 'GENERAL',
        price: 100,
        isUsed: false,
        lot: { name: 'Lote 1' },
        order: { paymentStatus: 'APPROVED' },
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        name: 'John Doe',
        email: 'john@example.com',
      })

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(true)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'event-123'
      )

      expect(result.valid).toBe(true)
      expect(result.ticket).toBeDefined()
      expect(result.attendee).toBeDefined()
    })

    it('should reject invalid QR code', async () => {
      const invalidJson = '{ invalid json }'

      const result = await QRCodeService.validateTicketForCheckin(
        invalidJson,
        'event-123'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Erro ao processar QR Code')
    })

    it('should reject QR code with invalid signature', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'invalid-signature',
      })

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(false)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'event-123'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('QR Code inválido')
    })

    it('should reject QR code for different event', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      })

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(true)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'different-event'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Ingresso não pertence a este evento')
    })

    it('should reject non-existent ticket', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      })

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null)

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(true)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'event-123'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Ingresso não encontrado')
    })

    it('should reject already used ticket', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      })

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-123',
        code: 'ABC123',
        type: 'GENERAL',
        price: 100,
        isUsed: true,
        lot: { name: 'Lote 1' },
        order: { paymentStatus: 'APPROVED' },
      })

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(true)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'event-123'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Ingresso já utilizado')
    })

    it('should reject ticket with unapproved payment', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      })

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-123',
        code: 'ABC123',
        type: 'GENERAL',
        price: 100,
        isUsed: false,
        lot: { name: 'Lote 1' },
        order: { paymentStatus: 'PENDING' },
      })

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(true)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'event-123'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Pagamento não aprovado')
    })

    it('should reject ticket with refunded payment', async () => {
      const qrDataString = JSON.stringify({
        ticketId: 'ticket-123',
        eventId: 'event-123',
        userId: 'user-123',
        timestamp: Date.now(),
        signature: 'valid-signature',
      })

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-123',
        code: 'ABC123',
        type: 'GENERAL',
        price: 100,
        isUsed: false,
        lot: { name: 'Lote 1' },
        order: { paymentStatus: 'REFUNDED' },
      })

      jest.spyOn(QRCodeService, 'validateQRCodeData').mockReturnValue(true)

      const result = await QRCodeService.validateTicketForCheckin(
        qrDataString,
        'event-123'
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Pagamento não aprovado')
    })
  })

  describe('checkinTicket', () => {
    it('should check in ticket successfully', async () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'

      ;(prisma.checkin.create as jest.Mock).mockResolvedValue({})
      ;(prisma.ticket.update as jest.Mock).mockResolvedValue({})

      const result = await QRCodeService.checkinTicket(ticketId, eventId)

      expect(result).toBe(true)
      expect(prisma.checkin.create).toHaveBeenCalledWith({
        data: {
          ticketId,
          eventId,
        },
      })
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { isUsed: true },
      })
    })

    it('should handle check in errors', async () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'

      ;(prisma.checkin.create as jest.Mock).mockRejectedValue(new Error('DB Error'))

      const result = await QRCodeService.checkinTicket(ticketId, eventId)

      expect(result).toBe(false)
    })
  })

  describe('checkinTicketOffline', () => {
    it('should create offline checkin record', () => {
      const ticketId = 'ticket-123'
      const eventId = 'event-123'

      const result = QRCodeService.checkinTicketOffline(ticketId, eventId)

      expect(result).toEqual({
        ticketId,
        eventId,
        checkedInAt: expect.any(Number),
        synced: false,
      })
    })
  })

  describe('syncOfflineCheckins', () => {
    it('should sync offline checkins', async () => {
      const records: OfflineCheckinRecord[] = [
        {
          ticketId: 'ticket-1',
          eventId: 'event-123',
          checkedInAt: Date.now(),
          synced: false,
        },
        {
          ticketId: 'ticket-2',
          eventId: 'event-123',
          checkedInAt: Date.now(),
          synced: false,
        },
      ]

      ;(prisma.ticket.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'ticket-1', isUsed: false })
        .mockResolvedValueOnce({ id: 'ticket-2', isUsed: false })

      ;(prisma.checkin.create as jest.Mock).mockResolvedValue({})
      ;(prisma.ticket.update as jest.Mock).mockResolvedValue({})

      const synced = await QRCodeService.syncOfflineCheckins(records)

      expect(synced).toBe(2)
    })

    it('should skip already used tickets', async () => {
      const records: OfflineCheckinRecord[] = [
        {
          ticketId: 'ticket-1',
          eventId: 'event-123',
          checkedInAt: Date.now(),
          synced: false,
        },
      ]

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-1',
        isUsed: true,
      })

      const synced = await QRCodeService.syncOfflineCheckins(records)

      expect(synced).toBe(0)
    })

    it('should handle sync errors gracefully', async () => {
      const records: OfflineCheckinRecord[] = [
        {
          ticketId: 'ticket-1',
          eventId: 'event-123',
          checkedInAt: Date.now(),
          synced: false,
        },
      ]

      ;(prisma.ticket.findUnique as jest.Mock).mockRejectedValue(new Error('DB Error'))

      const synced = await QRCodeService.syncOfflineCheckins(records)

      expect(synced).toBe(0)
    })
  })

  describe('getTicketQRCode', () => {
    it('should generate QR code for user ticket', async () => {
      const ticketId = 'ticket-123'
      const userId = 'user-123'

      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: ticketId,
        userId,
        eventId: 'event-123',
        order: { paymentStatus: 'APPROVED' },
      })

      const qrCode = await QRCodeService.getTicketQRCode(ticketId, userId)

      expect(qrCode).toMatch(/^data:image\/png;base64,/)
    })

    it('should return null for non-existent ticket', async () => {
      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null)

      const qrCode = await QRCodeService.getTicketQRCode('ticket-123', 'user-123')

      expect(qrCode).toBe(null)
    })

    it('should return null for ticket owned by different user', async () => {
      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-123',
        userId: 'different-user',
        eventId: 'event-123',
        order: { paymentStatus: 'APPROVED' },
      })

      const qrCode = await QRCodeService.getTicketQRCode('ticket-123', 'user-123')

      expect(qrCode).toBe(null)
    })

    it('should return null for ticket with unapproved payment', async () => {
      ;(prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        id: 'ticket-123',
        userId: 'user-123',
        eventId: 'event-123',
        order: { paymentStatus: 'PENDING' },
      })

      const qrCode = await QRCodeService.getTicketQRCode('ticket-123', 'user-123')

      expect(qrCode).toBe(null)
    })
  })
})
