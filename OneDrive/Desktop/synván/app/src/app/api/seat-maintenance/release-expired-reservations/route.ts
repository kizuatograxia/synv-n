import { NextRequest, NextResponse } from 'next/server'
import { seatMapService } from '@/lib/services/seat-map-service'

export async function POST(request: NextRequest) {
  try {
    const releasedCount = await seatMapService.releaseExpiredReservations()

    return NextResponse.json({
      message: 'Reservas expiradas liberadas',
      releasedCount
    })
  } catch (error) {
    console.error('Error releasing expired reservations:', error)
    return NextResponse.json(
      { error: 'Erro ao liberar reservas expiradas' },
      { status: 500 }
    )
  }
}
