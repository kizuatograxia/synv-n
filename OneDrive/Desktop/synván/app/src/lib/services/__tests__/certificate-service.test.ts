import { CertificateService } from '@/lib/services/certificate-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
    },
    certificate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('CertificateService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateVerificationCode', () => {
    it('should generate unique verification codes', () => {
      const code1 = CertificateService.generateVerificationCode()
      const code2 = CertificateService.generateVerificationCode()

      expect(code1).toHaveLength(32)
      expect(code2).toHaveLength(32)
      expect(code1).not.toBe(code2)
      expect(code1).toMatch(/^[0-9A-F]+$/)
    })
  })

  describe('generateCertificate', () => {
    it('should generate certificate for approved order', async () => {
      const mockOrder = {
        id: 'order1',
        paymentStatus: 'APPROVED',
        tickets: [
          { id: 'ticket1' },
        ],
        user: {
          id: 'user1',
          name: 'John Doe',
          email: 'john@example.com',
        },
        event: {
          id: 'event1',
          title: 'Test Event',
          startTime: new Date('2024-12-31'),
          organizer: {
            name: 'Organizer Name',
          },
        },
      }

      const mockCertificate = {
        id: 'cert1',
        attendeeName: 'John Doe',
        eventName: 'Test Event',
        verificationCode: 'ABC123',
      }

      ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
      ;(prisma.certificate.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.certificate.create as jest.Mock).mockResolvedValue(mockCertificate)

      const result = await CertificateService.generateCertificate({
        orderId: 'order1',
      })

      expect(result).toEqual(mockCertificate)
      expect(prisma.certificate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          attendeeName: 'John Doe',
          eventName: 'Test Event',
          orderId: 'order1',
          eventId: 'event1',
        }),
      })
    })

    it('should throw error for non-approved order', async () => {
      const mockOrder = {
        id: 'order1',
        paymentStatus: 'PENDING',
        tickets: [{ id: 'ticket1' }],
        user: { id: 'user1', name: 'John Doe' },
        event: {
          id: 'event1',
          title: 'Test Event',
          startTime: new Date('2024-12-31'),
          organizer: { name: 'Organizer' },
        },
      }

      ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)

      await expect(
        CertificateService.generateCertificate({ orderId: 'order1' })
      ).rejects.toThrow('Certificados são gerados apenas para pedidos aprovados')
    })

    it('should return existing certificate if already generated', async () => {
      const mockOrder = {
        id: 'order1',
        paymentStatus: 'APPROVED',
        tickets: [{ id: 'ticket1' }],
        user: { id: 'user1', name: 'John Doe' },
        event: {
          id: 'event1',
          title: 'Test Event',
          startTime: new Date('2024-12-31'),
          organizer: { name: 'Organizer' },
        },
      }

      const existingCertificate = {
        id: 'cert1',
        attendeeName: 'John Doe',
      }

      ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
      ;(prisma.certificate.findFirst as jest.Mock).mockResolvedValue(
        existingCertificate
      )

      const result = await CertificateService.generateCertificate({
        orderId: 'order1',
      })

      expect(result).toBe(existingCertificate)
      expect(prisma.certificate.create).not.toHaveBeenCalled()
    })
  })

  describe('verifyCertificate', () => {
    it('should verify valid certificate', async () => {
      const mockCertificate = {
        id: 'cert1',
        attendeeName: 'John Doe',
        eventName: 'Test Event',
        eventDate: new Date('2024-12-31'),
        verificationCode: 'ABC123',
        event: {
          title: 'Test Event',
          startTime: new Date('2024-12-31'),
          organizer: { name: 'Organizer' },
        },
        order: {
          user: {
            name: 'John Doe',
          },
        },
      }

      ;(prisma.certificate.findUnique as jest.Mock).mockResolvedValue(mockCertificate)

      const result = await CertificateService.verifyCertificate('ABC123')

      expect(result.valid).toBe(true)
      expect(result.certificate.attendeeName).toBe('John Doe')
    })

    it('should return invalid for non-existent certificate', async () => {
      ;(prisma.certificate.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await CertificateService.verifyCertificate('INVALID')

      expect(result.valid).toBe(false)
      expect(result.message).toBe('Certificado não encontrado')
    })
  })

  describe('downloadCertificate', () => {
    it('should mark certificate as downloaded', async () => {
      const mockCertificate = {
        id: 'cert1',
        order: {
          userId: 'user1',
        },
      }

      const updatedCertificate = {
        ...mockCertificate,
        downloadedAt: new Date(),
      }

      ;(prisma.certificate.findUnique as jest.Mock).mockResolvedValue(mockCertificate)
      ;(prisma.certificate.update as jest.Mock).mockResolvedValue(
        updatedCertificate
      )

      const result = await CertificateService.downloadCertificate('cert1', 'user1')

      expect(result).toEqual(mockCertificate)
      expect(prisma.certificate.update).toHaveBeenCalledWith({
        where: { id: 'cert1' },
        data: {
          downloadedAt: expect.any(Date),
        },
      })
    })

    it('should throw error if user does not own certificate', async () => {
      const mockCertificate = {
        id: 'cert1',
        order: {
          userId: 'user2',
        },
      }

      ;(prisma.certificate.findUnique as jest.Mock).mockResolvedValue(mockCertificate)

      await expect(
        CertificateService.downloadCertificate('cert1', 'user1')
      ).rejects.toThrow('Sem permissão para baixar este certificado')
    })
  })

  describe('generateCertificateHTML', () => {
    it('should generate valid HTML certificate', () => {
      const certificate = {
        id: 'cert1',
        attendeeName: 'John Doe',
        eventName: 'Test Event',
        eventDate: new Date('2024-12-31'),
        verificationCode: 'ABC123',
      }

      const html = CertificateService.generateCertificateHTML(certificate)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Certificado de Participação')
      expect(html).toContain('John Doe')
      expect(html).toContain('Test Event')
      expect(html).toContain('ABC123')
      expect(html).toContain('</html>')
    })
  })
})
