import QRCode from 'qrcode'
import crypto from 'crypto'
import { prisma } from '../db/prisma'

export interface QRCodeData {
  ticketId: string
  eventId: string
  userId: string
  timestamp: number
  signature: string
}

export interface ValidationResult {
  valid: boolean
  ticket?: {
    id: string
    code: string
    type: string
    price: number
    isUsed: boolean
    lot: {
      name: string
    }
  }
  attendee?: {
    name: string
    email: string
  }
  error?: string
}

export interface OfflineCheckinRecord {
  ticketId: string
  eventId: string
  checkedInAt: number
  synced: boolean
}

export class QRCodeService {
  private static readonly SECRET = process.env.QR_SECRET || 'default-secret-key'
  private static readonly QR_EXPIRY_MINUTES = 5

  static generateUniqueCode(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 9)
    return `${timestamp}${random}`.toUpperCase()
  }

  static generateQRCodeData(ticketId: string, eventId: string, userId: string): QRCodeData {
    const timestamp = Date.now()
    const payload = `${ticketId}|${eventId}|${userId}|${timestamp}`
    const signature = crypto
      .createHmac('sha256', this.SECRET)
      .update(payload)
      .digest('hex')

    return {
      ticketId,
      eventId,
      userId,
      timestamp,
      signature,
    }
  }

  static async generateQRCodeDataURL(ticketId: string, eventId: string, userId: string): Promise<string> {
    const data = this.generateQRCodeData(ticketId, eventId, userId)
    const jsonString = JSON.stringify(data)
    const dataURL = await QRCode.toDataURL(jsonString, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
    return dataURL
  }



  static validateQRCodeData(data: QRCodeData): boolean {
    const payload = `${data.ticketId}|${data.eventId}|${data.userId}|${data.timestamp}`
    const expectedSignature = crypto
      .createHmac('sha256', this.SECRET)
      .update(payload)
      .digest('hex')

    return data.signature === expectedSignature
  }

  static isQRCodeExpired(data: QRCodeData): boolean {
    const ageMinutes = (Date.now() - data.timestamp) / (1000 * 60)
    return ageMinutes > this.QR_EXPIRY_MINUTES
  }

  static async validateTicketForCheckin(
    qrDataString: string,
    eventId: string
  ): Promise<ValidationResult> {
    try {
      const qrData: QRCodeData = JSON.parse(qrDataString)

      if (!this.validateQRCodeData(qrData)) {
        return {
          valid: false,
          error: 'QR Code inválido',
        }
      }

      if (qrData.eventId !== eventId) {
        return {
          valid: false,
          error: 'Ingresso não pertence a este evento',
        }
      }

      const ticket = await prisma.ticket.findUnique({
        where: { id: qrData.ticketId },
        include: {
          lot: {
            select: {
              name: true,
            },
          },
          order: true,
        },
      })

      if (!ticket) {
        return {
          valid: false,
          error: 'Ingresso não encontrado',
        }
      }

      if (ticket.isUsed) {
        return {
          valid: false,
          error: 'Ingresso já utilizado',
          ticket: {
            id: ticket.id,
            code: ticket.code,
            type: ticket.type,
            price: ticket.price,
            isUsed: ticket.isUsed,
            lot: ticket.lot,
          },
        }
      }

      if (ticket.order.paymentStatus !== 'APPROVED') {
        return {
          valid: false,
          error: 'Pagamento não aprovado',
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: qrData.userId },
        select: {
          name: true,
          email: true,
        },
      })

      return {
        valid: true,
        ticket: {
          id: ticket.id,
          code: ticket.code,
          type: ticket.type,
          price: ticket.price,
          isUsed: ticket.isUsed,
          lot: ticket.lot,
        },
        attendee: user || undefined,
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Erro ao processar QR Code',
      }
    }
  }

  static async checkinTicket(ticketId: string, eventId: string): Promise<boolean> {
    try {
      await prisma.checkin.create({
        data: {
          ticketId,
          eventId,
        },
      })

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { isUsed: true },
      })

      return true
    } catch (error) {
      return false
    }
  }

  static checkinTicketOffline(
    ticketId: string,
    eventId: string
  ): OfflineCheckinRecord {
    return {
      ticketId,
      eventId,
      checkedInAt: Date.now(),
      synced: false,
    }
  }

  static async syncOfflineCheckins(records: OfflineCheckinRecord[]): Promise<number> {
    let synced = 0

    for (const record of records) {
      try {
        const ticket = await prisma.ticket.findUnique({
          where: { id: record.ticketId },
        })

        if (!ticket || ticket.isUsed) {
          continue
        }

        await prisma.checkin.create({
          data: {
            ticketId: record.ticketId,
            eventId: record.eventId,
          },
        })

        await prisma.ticket.update({
          where: { id: record.ticketId },
          data: {
            isUsed: true,
          },
        })

        synced++
      } catch (error) {
        continue
      }
    }

    return synced
  }

  static async getTicketQRCode(ticketId: string, userId: string): Promise<string | null> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: true,
      },
    })

    if (!ticket || ticket.userId !== userId) {
      return null
    }

    if (ticket.order.paymentStatus !== 'APPROVED') {
      return null
    }

    return this.generateQRCodeDataURL(ticket.id, ticket.eventId, ticket.userId)
  }
}
