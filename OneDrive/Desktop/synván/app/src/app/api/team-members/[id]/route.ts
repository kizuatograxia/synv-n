import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { TeamService, TeamRole } from '@/lib/services/team-service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { role } = body

    if (!role) {
      return NextResponse.json(
        { error: 'Campo obrigatório: role' },
        { status: 400 }
      )
    }

    if (!Object.values(TeamRole).includes(role)) {
      return NextResponse.json(
        { error: 'Cargo inválido' },
        { status: 400 }
      )
    }

    const updatedMember = await TeamService.updateTeamMember(
      params.id,
      session.user.id,
      { memberId: params.id, role }
    )

    return NextResponse.json(updatedMember)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar membro' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const result = await TeamService.removeTeamMember(
      params.id,
      session.user.id
    )

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao remover membro' },
      { status: 400 }
    )
  }
}
