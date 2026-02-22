import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { OrderService } from '@/lib/services/order-service'

/**
 * Refund Request Endpoint (Website-Only)
 *
 * DESIGN DECISION: Refund requests are intentionally website-only, not available via mobile API.
 *
 * Rationale:
 * - Refunds require review of event details, terms, and purchase history
 * - Complex approval logic (CDC 7-day rule, 48h pre-event policy) benefits from full UI context
 * - Reduces fraud risk by requiring authenticated web session with browser signals
 * - Simplifies dispute resolution with clear audit trail from web interactions
 *
 * See docs/refund-policy.md for complete refund policy details.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const result = await OrderService.requestRefund(params.id, session.user.id)

    return NextResponse.json({
      message: 'Solicitação de reembolso enviada com sucesso',
      order: result.order,
      refundAmount: result.refundAmount,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error('Error requesting refund:', error)
    return NextResponse.json(
      { error: 'Erro ao solicitar reembolso' },
      { status: 500 }
    )
  }
}
