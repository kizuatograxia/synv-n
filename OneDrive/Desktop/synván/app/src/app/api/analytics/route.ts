import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { AnalyticsService } from '@/lib/services/analytics-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 30

    const [summary, previousPeriodSummary, dailySales, demographics, realTimeStats, topEvents] = await Promise.all([
      AnalyticsService.getOrganizerSalesSummary(
        session.user.id,
        eventId || undefined
      ),
      AnalyticsService.getPreviousPeriodSummary(
        session.user.id,
        eventId || undefined,
        days
      ),
      AnalyticsService.getDailySales(
        session.user.id,
        eventId || undefined,
        days
      ),
      AnalyticsService.getAttendeeDemographics(
        session.user.id,
        eventId || undefined
      ),
      AnalyticsService.getRealTimeStats(
        session.user.id,
        eventId || undefined
      ),
      eventId
        ? Promise.resolve([])
        : AnalyticsService.getTopSellingEvents(session.user.id, 5)
    ])

    return NextResponse.json({
      summary,
      previousPeriodSummary,
      dailySales,
      demographics,
      realTimeStats,
      topEvents,
      eventId
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar analytics' },
      { status: 500 }
    )
  }
}
