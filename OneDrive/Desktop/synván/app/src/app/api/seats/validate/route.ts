import { NextRequest, NextResponse } from 'next/server'
import { CartService } from '@/lib/services/cart-service'
import { auth } from '@/lib/auth/config'

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
    const { eventId, seatIds } = body

    if (!eventId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      )
    }

    const seats = await CartService.validateSeatAvailability(seatIds, eventId)

    return NextResponse.json({ seats })
  } catch (error) {
    console.error('Error validating seats:', error)
    const message = error instanceof Error ? error.message : 'Erro ao validar assentos'
    return NextResponse.json(
      { error: message },
      { status: 400 }
    )
  }
}
