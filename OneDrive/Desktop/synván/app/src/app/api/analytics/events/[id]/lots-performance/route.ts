import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { id: params.id }
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    if (event.organizerId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    const lotPerformance = await AnalyticsService.getLotPerformance(params.id)

    return NextResponse.json({ lotPerformance })
  } catch (error) {
    console.error('Error fetching lot performance:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar performance de lotes' },
      { status: 500 }
    )
  }
}
