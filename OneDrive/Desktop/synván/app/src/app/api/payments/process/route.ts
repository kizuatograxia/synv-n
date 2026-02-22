import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { PaymentService } from '@/lib/payments/payment-service'
import { prisma } from '@/lib/db/prisma'
import { auditService } from '@/lib/services/audit-service'
import { z } from 'zod'

const paymentSchema = z.object({
  orderId: z.string().cuid('ID do pedido inválido'),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'APPLE_PAY', 'GOOGLE_PAY']),
  installments: z.number().int().min(1).max(10).optional().default(1),
  cardNumber: z.string().optional(),
  cardCvv: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardHolderName: z.string().optional(),
  pixKey: z.string().optional(),
  customerEmail: z.string().email('E-mail inválido'),
  customerCpf: z.string().optional(),
  customerPhone: z.string().optional(),
})

const refundSchema = z.object({
  transactionId: z.string(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'APPLE_PAY', 'GOOGLE_PAY']),
})

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
    const validatedData = paymentSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id: validatedData.orderId },
      include: {
        event: {
          select: {
            startTime: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      )
    }

    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    if (order.paymentStatus !== 'PENDING') {
      return NextResponse.json(
        { error: 'Pedido já processado' },
        { status: 400 }
      )
    }

    const paymentData = {
      ...validatedData,
      amount: order.totalAmount,
    }

    const result = await PaymentService.processPayment(paymentData)

    const updatedOrder = await prisma.order.update({
      where: { id: validatedData.orderId },
      data: {
        paymentStatus: result.status,
        paymentId: result.transactionId,
      },
    })

    // Log payment processing for audit
    await auditService.logPayment(validatedData.orderId, session.user.id, {
      success: result.status === 'APPROVED' || result.status === 'PENDING',
      amount: order.totalAmount,
      paymentMethod: validatedData.paymentMethod,
      transactionId: result.transactionId,
      failureReason: result.refusalReason,
    })

    return NextResponse.json({
      message: 'Pagamento processado com sucesso',
      payment: result,
      order: updatedOrder,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error processing payment:', error)
    return NextResponse.json(
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    )
  }
}
