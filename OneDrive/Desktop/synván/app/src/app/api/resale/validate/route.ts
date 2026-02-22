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
    const { ticketId } = body

    if (!ticketId) {
      return NextResponse.json(
        { error: 'Campo obrigatório: ticketId' },
        { status: 400 }
      )
    }

    const validation = await ResaleService.validateTicketForResale(
      ticketId,
      session.user.id
    )

    return NextResponse.json(validation)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao validar ingresso para revenda' },
      { status: 400 }
    )
  }
}
