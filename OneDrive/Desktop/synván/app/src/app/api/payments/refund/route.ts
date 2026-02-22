import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { PaymentService } from '@/lib/payments/payment-service'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const refundSchema = z.object({
  transactionId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'APPLE_PAY', 'GOOGLE_PAY']),
})

/**
 * Refund Processing Endpoint (Website-Only)
 *
 * DESIGN DECISION: Refund processing is intentionally website-only, not available via mobile API.
 *
 * Rationale:
 * - Refunds involve sensitive payment operations requiring strong authentication
 * - Web sessions provide richer security signals (IP, fingerprint, behavior patterns)
 * - Full UI context ensures users understand refund terms and consequences
 * - Reduces accidental refund requests and provides clear confirmation flow
 *
 * This endpoint processes approved refund requests through the payment gateway.
 * See docs/refund-policy.md for complete refund policy details.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = refundSchema.parse(body)

    const order = await prisma.order.findFirst({
      where: { paymentId: validatedData.transactionId },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      )
    }

    if (order.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    if (!order.refundRequested) {
      return NextResponse.json(
        { error: 'Solicitação de reembolso não encontrada' },
        { status: 400 }
      )
    }

    if (order.refundApproved) {
      return NextResponse.json(
        { error: 'Reembolso já processado' },
        { status: 400 }
      )
    }

    const result = await PaymentService.processRefund(
      validatedData.transactionId,
      validatedData.amount,
      validatedData.paymentMethod
    )

    if (result.status === 'FAILED') {
      return NextResponse.json(
        { error: 'Falha ao processar reembolso' },
        { status: 500 }
      )
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'REFUNDED',
        refundApproved: true,
        refundDate: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Reembolso processado com sucesso',
      refund: result,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error processing refund:', error)
    return NextResponse.json(
      { error: 'Erro ao processar reembolso' },
      { status: 500 }
    )
  }
}
