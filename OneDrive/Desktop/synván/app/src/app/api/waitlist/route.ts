import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { WaitlistService } from '@/lib/services/waitlist-service'

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

    const entry = await WaitlistService.joinWaitlist(session.user.id, {
      eventId,
      lotId,
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao entrar na lista de espera' },
      { status: 400 }
    )
  }
}

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
    const lotId = searchParams.get('lotId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    // Get user's own waitlist entries for this event
    const entries = await WaitlistService.getUserWaitlistEntries(
      session.user.id,
      eventId,
      lotId || undefined
    )

    return NextResponse.json({ entries })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar lista de espera' },
      { status: 500 }
    )
  }
}
