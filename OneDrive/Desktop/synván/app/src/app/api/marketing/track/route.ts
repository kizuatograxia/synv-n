import { NextRequest, NextResponse } from 'next/server'
import { MarketingService } from '@/lib/services/marketing-service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { eventId, eventType, metadata } = body

    if (!eventId || !eventType) {
      return NextResponse.json(
        { error: 'eventId e eventType são obrigatórios' },
        { status: 400 }
      )
    }

    const validEventTypes = ['PAGE_VIEW', 'PURCHASE', 'CHECKOUT']

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Tipo de evento inválido' },
        { status: 400 }
      )
    }

    const result = await MarketingService.trackEvent({
      eventId,
      eventType: eventType as any,
      metadata,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao rastrear evento' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório no body' },
        { status: 400 }
      )
    }

    const stats = await MarketingService.getIntegrationStats(eventId, userId)

    return NextResponse.json({ stats })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}
