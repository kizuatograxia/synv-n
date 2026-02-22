import { NextRequest, NextResponse } from 'next/server'
import { PaymentService } from '@/lib/payments/payment-service'
import { prisma } from '@/lib/db/prisma'
import { logger } from '@/lib/logger'
import { sendTicketConfirmationEmail } from '@/lib/notifications/notification-helper'
import { QRCodeService } from '@/lib/qrcode/qrcode-service'

/**
 * Payment Webhook Endpoint
 *
 * This endpoint receives payment status updates from the payment gateway.
 * It verifies the webhook signature and updates the order status accordingly.
 *
 * Supported gateways: Mercado Pago (with configured webhook secret)
 */
export async function POST(request: NextRequest) {
  try {
    // Get the signature from the header
    const signature = request.headers.get('x-signature') || request.headers.get('x-webhook-signature')

    if (!signature) {
      logger.error('Webhook received without signature')
      return NextResponse.json(
        { error: 'Assinatura não fornecida' },
        { status: 401 }
      )
    }

    // Get the raw payload for signature verification
    const rawPayload = await request.json()

    // Verify webhook signature using the adapter
    const adapter = PaymentService.getAdapter()

    if (!adapter) {
      console.error('Payment gateway adapter not configured')
      return NextResponse.json(
        { error: 'Gateway de pagamento não configurado' },
        { status: 503 }
      )
    }

    let notification
    try {
      notification = adapter.verifyWebhook(signature, rawPayload)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return NextResponse.json(
        { error: 'Assinatura inválida' },
        { status: 401 }
      )
    }

    // Find the order by payment ID (transaction ID)
    const order = await prisma.order.findFirst({
      where: {
        paymentId: notification.paymentId,
      },
      include: {
        tickets: true,
      },
    })

    if (!order) {
      console.warn(`Order not found for payment ID: ${notification.paymentId}`)
      // Still return 200 to prevent gateway from retrying
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // Map payment status from webhook to database status
    const newStatus = mapPaymentStatus(notification.status)

    // Update order payment status if it has changed
    if (order.paymentStatus !== newStatus) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newStatus,
          updatedAt: new Date(),
        },
      })

      logger.info(`Order ${order.id} payment status updated`, {
        from: order.paymentStatus,
        to: newStatus
      })

      // If payment was approved, trigger post-payment actions
      if (newStatus === 'APPROVED') {
        await handlePaymentApproved(order)
      }

      // If payment was refunded, update refund date
      if (newStatus === 'REFUNDED') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            refundDate: new Date(),
            refundApproved: true,
          },
        })
      }
    }

    return NextResponse.json(
      {
        received: true,
        orderId: order.id,
        paymentStatus: newStatus,
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Error processing webhook', { error })
    // Return 200 anyway to prevent gateway retries
    return NextResponse.json(
      { received: true, error: 'Erro ao processar webhook' },
      { status: 200 }
    )
  }
}

/**
 * Map payment gateway status to database PaymentStatus enum
 */
function mapPaymentStatus(status: string): 'PENDING' | 'APPROVED' | 'REFUSED' | 'REFUNDED' {
  const statusMap: Record<string, 'PENDING' | 'APPROVED' | 'REFUSED' | 'REFUNDED'> = {
    'pending': 'PENDING',
    'approved': 'APPROVED',
    'authorized': 'APPROVED',
    'processing': 'PENDING',
    'declined': 'REFUSED',
    'rejected': 'REFUSED',
    'cancelled': 'REFUSED',
    'refunded': 'REFUNDED',
    'chargeback': 'REFUNDED',
    'expired': 'REFUSED',
  }

  return statusMap[status] || 'PENDING'
}

/**
 * Handle post-payment actions when payment is approved
 *
 * This function sends notifications (email/SMS) after payment approval.
 * It uses graceful error handling - if notification services fail, the error
 * is logged but the order completion is not blocked.
 */
async function handlePaymentApproved(order: any) {
  logger.info(`Payment approved for order ${order.id}, triggering post-payment actions`)

  try {
    // Fetch order details with user and event information
    const orderWithDetails = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startTime: true,
            location: true,
          },
        },
        tickets: {
          include: {
            lot: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!orderWithDetails) {
      logger.error(`Order ${order.id} not found when trying to send confirmation`)
      return
    }

    // Generate QR codes for each ticket
    const ticketsWithQRCodes = await Promise.all(
      orderWithDetails.tickets.map(async (ticket: any) => {
        try {
          const qrCodeUrl = await QRCodeService.generateQRCodeDataURL(
            ticket.id,
            ticket.eventId,
            ticket.userId
          )
          return {
            ticketName: ticket.lot.name || ticket.type,
            quantity: 1,
            unitPrice: ticket.price,
            qrCodeUrl,
          }
        } catch (error) {
          logger.warn(`Failed to generate QR code for ticket ${ticket.id}`, {
            error: error instanceof Error ? error.message : String(error),
          })
          // Return ticket info without QR code
          return {
            ticketName: ticket.lot.name || ticket.type,
            quantity: 1,
            unitPrice: ticket.price,
          }
        }
      })
    )

    // Group tickets by type for cleaner email display
    const groupedTickets: Record<string, { quantity: number; unitPrice: number; qrCodeUrl?: string }> = {}
    for (const ticket of ticketsWithQRCodes) {
      const key = ticket.ticketName
      if (!groupedTickets[key]) {
        groupedTickets[key] = {
          quantity: 0,
          unitPrice: ticket.unitPrice,
          qrCodeUrl: ticket.qrCodeUrl,
        }
      }
      groupedTickets[key].quantity += ticket.quantity
      // Use the first QR code for this ticket type
      if (ticket.qrCodeUrl && !groupedTickets[key].qrCodeUrl) {
        groupedTickets[key].qrCodeUrl = ticket.qrCodeUrl
      }
    }

    const ticketsArray = Object.entries(groupedTickets).map(([ticketName, data]) => ({
      ticketName,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      qrCodeUrl: data.qrCodeUrl,
    }))

    // Get payment method display name
    const paymentMethodNames: Record<string, string> = {
      'CREDIT_CARD': 'Cartão de Crédito',
      'DEBIT_CARD': 'Cartão de Débito',
      'PIX': 'Pix',
      'BOLETO': 'Boleto',
    }
    const paymentMethod = paymentMethodNames[orderWithDetails.paymentMethod] || orderWithDetails.paymentMethod

    // Send confirmation email with graceful error handling
    // If email service fails (circuit breaker open, network error, etc.),
    // the error is logged but the order completion is not blocked
    const emailResult = await sendTicketConfirmationEmail(
      orderWithDetails.user.email,
      orderWithDetails.user.name,
      orderWithDetails.id,
      orderWithDetails.event.title,
      orderWithDetails.event.startTime,
      orderWithDetails.event.location || 'Online',
      ticketsArray,
      orderWithDetails.totalAmount,
      paymentMethod,
      `${process.env.NEXT_PUBLIC_APP_URL}/orders/${orderWithDetails.id}`
    )

    if (emailResult.success) {
      logger.info(`Confirmation email sent for order ${order.id}`)
    } else {
      logger.warn(`Failed to send confirmation email for order ${order.id}`, {
        error: emailResult.error,
      })
    }

    // TODO: Implement these actions in future tasks:
    // - Send SMS confirmation
    // - Update analytics
  } catch (error) {
    // Log any unexpected errors but don't block order completion
    logger.error(`Error in post-payment actions for order ${order.id}`, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
