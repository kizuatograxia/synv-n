import { prisma } from '../db/prisma'
import crypto from 'crypto'

export interface CertificateTemplate {
  id: string
  name: string
  logoUrl?: string
  signatureUrl?: string
  backgroundColor: string
  textColor: string
  font: string
}

export interface GenerateCertificateInput {
  orderId: string
  templateId?: string
}

export class CertificateService {
  static generateVerificationCode(): string {
    return crypto
      .randomBytes(16)
      .toString('hex')
      .toUpperCase()
  }

  static async generateCertificate(input: GenerateCertificateInput) {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        event: true,
        tickets: true,
        user: true,
      },
    })

    if (!order) {
      throw new Error('Pedido não encontrado')
    }

    if (order.paymentStatus !== 'APPROVED') {
      throw new Error('Certificados são gerados apenas para pedidos aprovados')
    }

    if (order.tickets.length === 0) {
      throw new Error('Este pedido não possui ingressos')
    }

    const attendee = order.user
    const event = order.event

    const existingCertificate = await prisma.certificate.findFirst({
      where: {
        orderId: order.id,
      },
    })

    if (existingCertificate) {
      return existingCertificate
    }

    const verificationCode = this.generateVerificationCode()

    const certificate = await prisma.certificate.create({
      data: {
        attendeeName: attendee.name,
        eventName: event.title,
        eventDate: event.startTime,
        verificationCode,
        templateId: input.templateId,
        orderId: order.id,
        eventId: event.id,
      },
    })

    return certificate
  }

  static async getCertificatesByEvent(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        organizerId: true,
      },
    })

    if (!event) {
      throw new Error('Evento não encontrado')
    }

    if (event.organizerId !== userId) {
      throw new Error('Sem permissão para visualizar certificados')
    }

    const certificates = await prisma.certificate.findMany({
      where: {
        eventId,
      },
      include: {
        order: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return certificates
  }

  static async getCertificatesByUser(userId: string) {
    const certificates = await prisma.certificate.findMany({
      where: {
        order: {
          userId,
        },
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
            imageUrl: true,
          },
        },
        order: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return certificates
  }

  static async verifyCertificate(verificationCode: string) {
    const certificate = await prisma.certificate.findUnique({
      where: {
        verificationCode,
      },
      include: {
        event: {
          select: {
            title: true,
            startTime: true,
            organizer: {
              select: {
                name: true,
              },
            },
          },
        },
        order: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!certificate) {
      return {
        valid: false,
        message: 'Certificado não encontrado',
      }
    }

    return {
      valid: true,
      certificate: {
        attendeeName: certificate.attendeeName,
        eventName: certificate.eventName,
        eventDate: certificate.eventDate,
        verificationCode: certificate.verificationCode,
        organizer: certificate.event.organizer.name,
      },
    }
  }

  static async downloadCertificate(certificateId: string, userId: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        order: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!certificate) {
      throw new Error('Certificado não encontrado')
    }

    if (certificate.order.userId !== userId) {
      throw new Error('Sem permissão para baixar este certificado')
    }

    await prisma.certificate.update({
      where: { id: certificateId },
      data: {
        downloadedAt: new Date(),
      },
    })

    return certificate
  }

  static generateCertificateHTML(certificate: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificado de Participação</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Roboto:wght@400;700&display=swap');

          body {
            font-family: 'Roboto', sans-serif;
            margin: 0;
            padding: 40px;
            background-color: #f5f5f5;
          }

          .certificate {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 60px;
            border: 10px solid #4a90a4;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
          }

          .certificate-header {
            margin-bottom: 40px;
          }

          .certificate-title {
            font-family: 'Playfair Display', serif;
            font-size: 48px;
            color: #333;
            margin: 0 0 20px 0;
            font-weight: 700;
          }

          .certificate-subtitle {
            font-size: 18px;
            color: #666;
            margin: 0;
          }

          .certificate-body {
            margin: 60px 0;
          }

          .attendee-name {
            font-family: 'Playfair Display', serif;
            font-size: 42px;
            color: #4a90a4;
            margin: 20px 0;
            font-weight: 700;
          }

          .certificate-text {
            font-size: 18px;
            color: #333;
            margin: 20px 0;
            line-height: 1.6;
          }

          .event-details {
            margin: 40px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
          }

          .event-name {
            font-size: 24px;
            color: #333;
            margin: 0 0 10px 0;
            font-weight: 700;
          }

          .event-date {
            font-size: 16px;
            color: #666;
            margin: 0;
          }

          .certificate-footer {
            margin-top: 60px;
            padding-top: 40px;
            border-top: 2px solid #e0e0e0;
          }

          .verification-code {
            font-family: 'Roboto', monospace;
            font-size: 16px;
            color: #4a90a4;
            font-weight: 700;
            letter-spacing: 2px;
          }

          .verification-label {
            font-size: 12px;
            color: #999;
            margin: 0 0 10px 0;
            text-transform: uppercase;
          }

          .issue-date {
            font-size: 14px;
            color: #666;
            margin-top: 20px;
          }

          @media print {
            body {
              padding: 0;
              background-color: white;
            }

            .certificate {
              box-shadow: none;
              border-width: 5px;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="certificate-header">
            <h1 class="certificate-title">Certificado de Participação</h1>
            <p class="certificate-subtitle">Certificamos que</p>
          </div>

          <div class="certificate-body">
            <div class="attendee-name">${certificate.attendeeName}</div>
            <p class="certificate-text">
              participou com sucesso do evento
            </p>
          </div>

          <div class="event-details">
            <div class="event-name">${certificate.eventName}</div>
            <div class="event-date">
              Realizado em ${new Date(certificate.eventDate).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>

          <div class="certificate-footer">
            <div class="verification-label">Código de Verificação</div>
            <div class="verification-code">${certificate.verificationCode}</div>
            <div class="issue-date">
              Emitido em ${new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }

  static getCertificateUrl(certificateId: string): string {
    return `/certificates/${certificateId}`
  }

  static getVerificationUrl(verificationCode: string): string {
    return `/certificates/verify?code=${verificationCode}`
  }
}
