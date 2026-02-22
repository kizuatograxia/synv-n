import { NextRequest, NextResponse } from 'next/server'
import { seatMapService } from '@/lib/services/seat-map-service'
import { cacheGet, cacheSet, cacheDelete, CACHE_TTL } from '@/lib/cache/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; mapId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const sectorId = searchParams.get('sectorId') || undefined

    // Generate cache key based on mapId and sectorId
    const cacheKey = `seat-availability:${params.mapId}:${sectorId || 'all'}`

    // Try to get from cache first
    const cachedSeats = await cacheGet<{ seats: any[] }>(cacheKey)
    if (cachedSeats) {
      return NextResponse.json(cachedSeats)
    }

    const seats = await seatMapService.getAvailableSeats(
      params.mapId,
      sectorId
    )

    const responseData = { seats }

    // Cache the response for 30 seconds
    await cacheSet(cacheKey, responseData, CACHE_TTL.SEAT_MAP_AVAILABILITY)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching available seats:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar assentos disponíveis' },
      { status: 500 }
    )
  }
}
