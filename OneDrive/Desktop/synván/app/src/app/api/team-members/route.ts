import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { TeamService, TeamRole } from '@/lib/services/team-service'

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
    const { email, role, eventId } = body

    if (!email || !role || !eventId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: email, role, eventId' },
        { status: 400 }
      )
    }

    if (!Object.values(TeamRole).includes(role)) {
      return NextResponse.json(
        { error: 'Cargo inválido' },
        { status: 400 }
      )
    }

    const teamMember = await TeamService.inviteTeamMember(
      session.user.id,
      eventId,
      { email, role, eventId }
    )

    return NextResponse.json(teamMember, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao convidar membro' },
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

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    const teamMembers = await TeamService.getTeamMembers(
      eventId,
      session.user.id
    )

    return NextResponse.json({ teamMembers })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar equipe' },
      { status: 500 }
    )
  }
}
