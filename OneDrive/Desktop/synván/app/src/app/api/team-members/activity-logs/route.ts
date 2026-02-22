import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { TeamService } from '@/lib/services/team-service'

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

    const activityLogs = await TeamService.getActivityLogs(
      eventId,
      session.user.id
    )

    return NextResponse.json({ activityLogs })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar logs' },
      { status: 500 }
    )
  }
}
