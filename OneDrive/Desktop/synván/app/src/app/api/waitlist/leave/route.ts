import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { WaitlistService } from '@/lib/services/waitlist-service'

export async function DELETE(req: NextRequest) {
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

    const result = await WaitlistService.leaveWaitlist(
      session.user.id,
      eventId,
      lotId
    )

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao sair da lista de espera' },
      { status: 400 }
    )
  }
}
