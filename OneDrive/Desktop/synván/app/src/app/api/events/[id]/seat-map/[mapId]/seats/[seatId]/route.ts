import { NextRequest, NextResponse } from 'next/server'
import { seatMapService } from '@/lib/services/seat-map-service'
import { auth } from '@/lib/auth/config'
import { z } from 'zod'
import { cacheInvalidatePattern } from '@/lib/cache/redis'

const reservationConfirmSchema = z.object({
  ticketIds: z.array(z.string())
})

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string; seatId: string } }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'release-reservation') {
      await seatMapService.releaseReservations(session.user.id, [params.seatId])

      // Invalidate seat availability cache for this seat map
      await cacheInvalidatePattern(`seat-availability:${params.mapId}:*`)

      return NextResponse.json({
        message: 'Reserva liberada com sucesso'
      })
    }

    return NextResponse.json(
      { error: 'Ação inválida' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error releasing reservation:', error)
    return NextResponse.json(
      { error: 'Erro ao liberar reserva' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string; seatId: string } }
) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'confirm-reservation') {
    return await confirmReservation(request, params.seatId, params.mapId)
  } else {
    return NextResponse.json(
      { error: 'Ação inválida' },
      { status: 400 }
    )
  }
}

async function confirmReservation(request: NextRequest, seatId: string, mapId: string) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = reservationConfirmSchema.parse(body)

    const seats = await seatMapService.confirmSeatReservations(
      [seatId],
      validatedData.ticketIds
    )

    // Invalidate seat availability cache for this seat map
    await cacheInvalidatePattern(`seat-availability:${mapId}:*`)

    return NextResponse.json({
      message: 'Reserva confirmada com sucesso',
      seats
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error confirming reservation:', error)
    return NextResponse.json(
      { error: 'Erro ao confirmar reserva' },
      { status: 500 }
    )
  }
}
