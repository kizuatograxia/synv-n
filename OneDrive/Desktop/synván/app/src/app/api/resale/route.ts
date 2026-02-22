import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { ResaleService } from '@/lib/services/resale-service'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { ticketId, resalePrice } = body

    if (!ticketId || resalePrice === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ticketId, resalePrice' },
        { status: 400 }
      )
    }

    const listing = await ResaleService.createResaleListing(
      session.user.id,
      { ticketId, resalePrice }
    )

    return NextResponse.json(listing, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao criar listing de revenda' },
      { status: 400 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')
    const status = searchParams.get('status')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')

    const filters: any = {}

    if (eventId) filters.eventId = eventId
    if (status) filters.status = status
    if (minPrice) filters.minPrice = parseFloat(minPrice)
    if (maxPrice) filters.maxPrice = parseFloat(maxPrice)

    const listings = await ResaleService.getResaleListings(filters)

    return NextResponse.json(listings)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar listings de revenda' },
      { status: 500 }
    )
  }
}
