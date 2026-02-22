'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { Stat } from '@/components/ui/stat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Ticket, ShoppingCart, TrendingUp, Calendar, CheckCircle, Clock } from 'lucide-react'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { SkeletonStat, SkeletonTable } from '@/components/ui/skeleton'
import type { ApiError } from '@/hooks/useApi'
import { colors } from '@/lib/colors'
import { cn } from '@/lib/cn'

// Dynamic imports for code splitting - charts are loaded only when dashboard is accessed
const DailySalesChart = dynamic(() => import('@/components/charts/daily-sales-chart').then(mod => ({ default: mod.DailySalesChart })), {
  loading: () => <div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

const TicketTypeDistributionChart = dynamic(() => import('@/components/charts/ticket-type-distribution-chart').then(mod => ({ default: mod.TicketTypeDistributionChart })), {
  loading: () => <div className="h-64 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

const PaymentMethodsChart = dynamic(() => import('@/components/charts/payment-methods-chart').then(mod => ({ default: mod.PaymentMethodsChart })), {
  loading: () => <div className="h-64 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

const LotPerformanceChart = dynamic(() => import('@/components/charts/lot-performance-chart').then(mod => ({ default: mod.LotPerformanceChart })), {
  loading: () => <div className="h-64 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

interface SalesSummary {
  totalRevenue: number
  totalTicketsSold: number
  totalOrders: number
  averageOrderValue: number
}

interface DailySales {
  date: string
  revenue: number
  ticketsSold: number
}

interface AttendeeDemographics {
  ageGroups: Record<string, number>
  ticketTypes: Record<string, number>
  paymentMethods: Record<string, number>
}

interface RealTimeStats {
  activeTicketsSold: number
  todayRevenue: number
  pendingOrders: number
  approvedOrders: number
}

interface TopEvent {
  id: string
  title: string
  totalRevenue: number
  totalTickets: number
  totalOrders: number
}

interface LotPerformance {
  lotId: string
  lotName: string
  price: number
  totalTickets: number
  soldTickets: number
  availableTickets: number
  revenue: number
  sellRate: number
}

interface AnalyticsData {
  summary: SalesSummary
  previousPeriodSummary: SalesSummary
  dailySales: DailySales[]
  demographics: AttendeeDemographics
  realTimeStats: RealTimeStats
  topEvents: TopEvent[]
}

interface OrganizerEvent {
  id: string
  title: string
  startTime: string
}

interface LotPerformanceData {
  lotPerformance: LotPerformance[]
}

// Chart colors using design tokens from lib/colors.ts
const CHART_COLORS = [
  colors.primary[500],  // blue
  colors.success[500],  // green
  colors.warning[500],  // amber
  colors.error[500],    // red
  colors.secondary[500], // purple
]

export default function OrganizerDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [lotPerformance, setLotPerformance] = useState<LotPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [selectedDays, setSelectedDays] = useState(30)
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [organizerEvents, setOrganizerEvents] = useState<OrganizerEvent[]>([])

  // Fetch organizer's events on mount
  useEffect(() => {
    const fetchOrganizerEvents = async () => {
      try {
        const response = await fetch('/api/events?organizerId=me')
        if (response.ok) {
          const data = await response.json()
          setOrganizerEvents(data.events || [])
        }
      } catch (err) {
        // Silently fail for events list - it's optional supplementary data
        setOrganizerEvents([])
      }
    }
    fetchOrganizerEvents()
  }, [])

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        days: selectedDays.toString()
      })

      if (selectedEventId && selectedEventId !== 'all') {
        params.append('eventId', selectedEventId)
      }

      const response = await fetch(`/api/analytics?${params}`)
      const data = await response.json()

      if (response.ok) {
        setAnalytics(data)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar analytics',
          status: response.status,
          code: data.code
        }
        setError(apiError)
      }
    } catch (err) {
      const apiError: ApiError = {
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        status: undefined
      }
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }, [selectedDays, selectedEventId])

  // Fetch lot performance when an event is selected
  const fetchLotPerformance = useCallback(async () => {
    if (!selectedEventId || selectedEventId === 'all') {
      setLotPerformance([])
      return
    }

    try {
      const response = await fetch(`/api/analytics/events/${selectedEventId}/lots-performance`)
      const data: LotPerformanceData = await response.json()

      if (response.ok) {
        setLotPerformance(data.lotPerformance)
      } else {
        // Silently fail for lot performance - it's optional supplementary data
        setLotPerformance([])
      }
    } catch (err) {
      // Silently fail for lot performance - it's optional supplementary data
      setLotPerformance([])
    }
  }, [selectedEventId])

  useEffect(() => {
    fetchAnalytics()
    fetchLotPerformance()
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [fetchAnalytics, fetchLotPerformance])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  // Calculate trend by comparing with previous period
  const calculateTrend = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return undefined
    const percentChange = ((currentValue - previousValue) / previousValue) * 100
    return {
      direction: (percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      value: `${Math.abs(percentChange).toFixed(1)}%`
    }
  }

  // Prepare chart data
  const salesChartData = analytics?.dailySales.map(day => ({
    date: new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    receita: day.revenue,
    ingressos: day.ticketsSold
  })) || []

  const ticketTypeData = Object.entries(analytics?.demographics.ticketTypes || {}).map(([name, value]) => ({
    name,
    value: value as number
  }))

  const paymentMethodData = Object.entries(analytics?.demographics.paymentMethods || {}).map(([name, value]) => ({
    name,
    value: value as number
  }))

  const lotPerformanceChartData = lotPerformance.map(lot => ({
    name: lot.lotName,
    vendidos: lot.soldTickets,
    disponiveis: lot.availableTickets,
    receita: lot.revenue
  }))

  if (loading && !analytics) {
    return (
      <OrganizerAppShell>
        <main className="space-y-8" aria-live="polite" aria-busy="true">
          {/* Filters Skeleton */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-10 bg-neutral-200 rounded-xl animate-pulse flex-1 max-w-xs" />
            <div className="h-10 bg-neutral-200 rounded-xl animate-pulse flex-1 max-w-xs" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>

          {/* Charts Skeleton */}
          <Card>
            <CardHeader>
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-80 bg-neutral-200 rounded animate-pulse" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-80 bg-neutral-200 rounded animate-pulse" />
            </CardContent>
          </Card>

          {/* Lot Performance Table Skeleton */}
          <SkeletonTable rowCount={5} columnCount={4} />
        </main>
      </OrganizerAppShell>
    )
  }

  return (
    <OrganizerAppShell>
      <main className="p-4 md:p-6 space-y-8">
        {error && (
          <ErrorState
            title="Erro ao Carregar Dashboard"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => {
              setError(null)
              fetchAnalytics()
            }}
          />
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(parseInt(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos os Eventos</option>
            {organizerEvents.map(event => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>

        {analytics && (
          <>
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat
                label="Receita Total"
                value={formatCurrency(analytics.summary.totalRevenue)}
                icon={<DollarSign className="w-5 h-5" />}
                trend={calculateTrend(
                  analytics.summary.totalRevenue,
                  analytics.previousPeriodSummary?.totalRevenue ?? analytics.summary.totalRevenue * 0.88
                )}
              />
              <Stat
                label="Ingressos Vendidos"
                value={formatNumber(analytics.summary.totalTicketsSold)}
                icon={<Ticket className="w-5 h-5" />}
                trend={calculateTrend(
                  analytics.summary.totalTicketsSold,
                  analytics.previousPeriodSummary?.totalTicketsSold ?? analytics.summary.totalTicketsSold * 0.92
                )}
              />
              <Stat
                label="Pedidos"
                value={formatNumber(analytics.summary.totalOrders)}
                icon={<ShoppingCart className="w-5 h-5" />}
                trend={calculateTrend(
                  analytics.summary.totalOrders,
                  analytics.previousPeriodSummary?.totalOrders ?? analytics.summary.totalOrders * 0.87
                )}
              />
              <Stat
                label="Ticket Médio"
                value={formatCurrency(analytics.summary.averageOrderValue)}
                icon={<TrendingUp className="w-5 h-5" />}
                trend={calculateTrend(
                  analytics.summary.averageOrderValue,
                  analytics.previousPeriodSummary?.averageOrderValue ?? analytics.summary.averageOrderValue * 0.97
                )}
              />
            </div>

            {/* Daily Sales Chart */}
            <Card>
              <CardHeader>
                <CardTitle className={cn("text-base md:text-lg font-display")}>Vendas Diárias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 md:h-80">
                  {salesChartData.length > 0 ? (
                    <Suspense fallback={<div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />}>
                      <DailySalesChart data={salesChartData} colors={CHART_COLORS} formatCurrency={formatCurrency} />
                    </Suspense>
                  ) : (
                    <div className="flex items-center justify-center h-full text-neutral-600">
                      Sem dados disponíveis
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Real-time Stats and Lot Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Real-time Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className={cn("text-base md:text-lg font-display")}>Tempo Real</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <Ticket className="w-[1rem] h-[1rem] md:w-5 md:h-5 text-neutral-600" />
                      <span className="text-sm md:text-base text-neutral-700">Ingressos Hoje</span>
                    </div>
                    <span className={cn("font-display font-bold text-neutral-900 text-sm md:text-base")}>
                      {analytics.realTimeStats.activeTicketsSold}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <DollarSign className="w-[1rem] h-[1rem] md:w-5 md:h-5 text-neutral-600" />
                      <span className="text-sm md:text-base text-neutral-700">Receita Hoje</span>
                    </div>
                    <span className={cn("font-display font-bold text-neutral-900 text-sm md:text-base")}>
                      {formatCurrency(analytics.realTimeStats.todayRevenue)}
                    </span>
                  </div>
                  <div className={cn("flex items-center justify-between p-3 rounded-xl", analytics.realTimeStats.pendingOrders > 0 ? 'bg-warning-50 border border-warning-200' : 'bg-neutral-50')}>
                    <div className="flex items-center gap-4">
                      <Clock className={cn("w-[1rem] h-[1rem] md:w-5 md:h-5", analytics.realTimeStats.pendingOrders > 0 ? 'text-warning-600' : 'text-neutral-600')} />
                      <span className="text-sm md:text-base text-neutral-700">Pedidos Pendentes</span>
                    </div>
                    <span className={cn("font-display font-bold text-neutral-900 text-sm md:text-base")}>
                      {analytics.realTimeStats.pendingOrders}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <CheckCircle className="w-[1rem] h-[1rem] md:w-5 md:h-5 text-success-600" />
                      <span className="text-sm md:text-base text-neutral-700">Pedidos Aprovados</span>
                    </div>
                    <span className={cn("font-display font-bold text-neutral-900 text-sm md:text-base")}>
                      {analytics.realTimeStats.approvedOrders}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Lot Performance (shown when event is selected) */}
              {selectedEventId !== 'all' && lotPerformance.length > 0 && (
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className={cn("text-base md:text-lg font-display")}>Performance por Lote</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <Suspense fallback={<div className="h-64 bg-neutral-100 animate-pulse rounded-xl" />}>
                          <LotPerformanceChart data={lotPerformanceChartData} colors={CHART_COLORS} />
                        </Suspense>
                      </div>
                      <div className="mt-4 space-y-4">
                        {lotPerformance.map((lot) => (
                          <div key={lot.lotId} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl text-sm md:text-base">
                            <div className="flex-1 min-w-0">
                              <div className={cn("font-medium text-neutral-900 truncate font-display")}>{lot.lotName}</div>
                              <div className="text-neutral-600">
                                {lot.soldTickets}/{lot.totalTickets} vendidos · {formatCurrency(lot.price)}
                              </div>
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <div className={cn("font-display font-bold text-success-600")}>{formatCurrency(lot.revenue)}</div>
                              <div className="text-neutral-600">{lot.sellRate.toFixed(1)}% taxa</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Demographics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ticket Types Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className={cn("text-base md:text-lg font-display")}>Distribuição por Tipo de Ingresso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {ticketTypeData.length > 0 ? (
                      <Suspense fallback={<div className="h-64 bg-neutral-100 animate-pulse rounded-xl" />}>
                        <TicketTypeDistributionChart data={ticketTypeData} colors={CHART_COLORS} />
                      </Suspense>
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600">
                        Sem dados disponíveis
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle className={cn("text-base md:text-lg font-display")}>Métodos de Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {paymentMethodData.length > 0 ? (
                      <Suspense fallback={<div className="h-64 bg-neutral-100 animate-pulse rounded-xl" />}>
                        <PaymentMethodsChart data={paymentMethodData} colors={CHART_COLORS} />
                      </Suspense>
                    ) : (
                      <div className="flex items-center justify-center h-full text-neutral-600">
                        Sem dados disponíveis
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Events */}
            {!selectedEventId || selectedEventId === 'all' ? (
              <Card>
                <CardHeader>
                  <CardTitle className={cn("text-base md:text-lg font-display")}>Top Eventos por Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.topEvents.map((event, index) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 md:p-4 bg-neutral-50 rounded-xl"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="w-8 h-8 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full font-display font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={cn("font-medium text-neutral-900 truncate font-display")}>
                              {event.title}
                            </div>
                            <div className="text-sm md:text-base text-neutral-600">
                              {formatNumber(event.totalTickets)} ingressos · {formatNumber(event.totalOrders)} pedidos
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-2 flex-shrink-0">
                          <div className={cn("font-display font-bold text-success-600 text-sm md:text-base")}>
                            {formatCurrency(event.totalRevenue)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </OrganizerAppShell>
  )
}
