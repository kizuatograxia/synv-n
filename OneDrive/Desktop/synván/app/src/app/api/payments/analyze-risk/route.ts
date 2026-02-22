import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { PaymentService } from '@/lib/payments/payment-service'
import { z } from 'zod'

const riskAnalysisSchema = z.object({
  orderId: z.string().cuid('ID do pedido inválido'),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'APPLE_PAY', 'GOOGLE_PAY']),
  amount: z.number().positive(),
  customerCpf: z.string().optional(),
  customerPhone: z.string().optional(),
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

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = riskAnalysisSchema.parse(body)

    const riskAnalysis = await PaymentService.performRiskAnalysis({
      orderId: validatedData.orderId,
      paymentMethod: validatedData.paymentMethod,
      amount: validatedData.amount,
      customerCpf: validatedData.customerCpf,
      customerPhone: validatedData.customerPhone,
      installments: 1,
      customerEmail: 'admin@simprao.test',
    })

    return NextResponse.json({
      riskAnalysis,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error analyzing risk:', error)
    return NextResponse.json(
      { error: 'Erro ao analisar risco' },
      { status: 500 }
    )
  }
}
