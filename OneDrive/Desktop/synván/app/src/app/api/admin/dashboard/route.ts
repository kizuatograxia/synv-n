import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { AdminService } from '@/lib/services/admin-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 30

    const [stats, disputes, anticipations, activity, timeSeries] = await Promise.all([
      AdminService.getPlatformStats(),
      AdminService.getDisputeStats(days),
      AdminService.getAnticipationStats(days),
      AdminService.getRecentActivity(50),
      AdminService.getPlatformMetricsTimeSeries(days)
    ])

    return NextResponse.json({
      stats,
      disputes,
      anticipations,
      activity,
      timeSeries
    })
  } catch (error) {
    console.error('Error fetching admin dashboard:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dashboard' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Sem permissão' },
        { status: 403 }
      )
    }

    const body = await request.json()

    if (action === 'approve-anticipation') {
      const { payoutId } = body
      await AdminService.approveAnticipation(payoutId)
      return NextResponse.json({
        message: 'Antecipação aprovada com sucesso'
      })
    }

    if (action === 'reject-anticipation') {
      const { payoutId, reason } = body
      await AdminService.rejectAnticipation(payoutId, reason)
      return NextResponse.json({
        message: 'Antecipação rejeitada com sucesso'
      })
    }

    return NextResponse.json(
      { error: 'Ação inválida' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in admin API:', error)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}
