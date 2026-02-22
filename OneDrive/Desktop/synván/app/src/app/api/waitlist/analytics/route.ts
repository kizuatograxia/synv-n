import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { WaitlistService } from '@/lib/services/waitlist-service'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    const analytics = await WaitlistService.getWaitlistAnalytics(
      eventId,
      session.user.id
    )

    return NextResponse.json({ analytics })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar analytics' },
      { status: 500 }
    )
  }
}

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
    const { eventId, lotId } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    const result = await WaitlistService.notifyWaitlist(eventId, lotId)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao notificar lista de espera' },
      { status: 400 }
    )
  }
}
