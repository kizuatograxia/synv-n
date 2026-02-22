'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { AdminAppShell } from '@/components/layout/app-shell'
import { Stat } from '@/components/ui/stat'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SkeletonStat, SkeletonTable, SkeletonTextBlock } from '@/components/ui/skeleton'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import type { ApiError } from '@/hooks/useApi'
import { colors } from '@/lib/colors'

// Dynamic imports for code splitting - charts are loaded only when admin dashboard is accessed
const AdminRevenueChart = dynamic(() => import('@/components/charts/admin-revenue-chart').then(mod => ({ default: mod.AdminRevenueChart })), {
  loading: () => <div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

const AdminOrdersChart = dynamic(() => import('@/components/charts/admin-orders-chart').then(mod => ({ default: mod.AdminOrdersChart })), {
  loading: () => <div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

const AdminTrendsChart = dynamic(() => import('@/components/charts/admin-trends-chart').then(mod => ({ default: mod.AdminTrendsChart })), {
  loading: () => <div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />,
  ssr: false
})

interface PlatformStats {
  totalRevenue: number
  totalOrders: number
  totalTickets: number
  totalOrganizers: number
  totalEvents: number
  activeOrganizers: number
  activeEvents: number
}

interface DisputeStats {
  pending: number
  resolved: number
  escalated: number
  avgResolutionTime: number
}

interface AnticipationStats {
  pending: number
  approved: number
  rejected: number
  avgProcessingTime: number
}

interface ActivityItem {
  type: string
  data: any
  timestamp: Date
}

interface TimeSeriesDataPoint {
  date: string
  revenue: number
  orders: number
  tickets: number
}

interface TimeSeriesMetrics {
  daily: TimeSeriesDataPoint[]
  summary: {
    totalRevenue: number
    totalOrders: number
    totalTickets: number
    avgDailyRevenue: number
    avgDailyOrders: number
  }
}

interface UserInfo {
  id: string
  name: string | null
  email: string
  role: string
  lastSeen: Date
  orderCount: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [disputes, setDisputes] = useState<DisputeStats | null>(null)
  const [anticipations, setAnticipations] = useState<AnticipationStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [timeSeries, setTimeSeries] = useState<TimeSeriesMetrics | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'ADMIN' | 'ORGANIZER' | 'ATTENDEE'>('ALL')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/admin/dashboard?days=${days}`)
      const data = await response.json()

      if (response.ok) {
        setStats(data.stats)
        setDisputes(data.disputes)
        setAnticipations(data.anticipations)
        setActivity(data.activity)
        setTimeSeries(data.timeSeries)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar dashboard',
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
  }, [days])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  // Extract unique users from activity data
  const getUniqueUsers = useCallback((): UserInfo[] => {
    const userMap = new Map<string, UserInfo>()

    activity.forEach((item: ActivityItem) => {
      if (item.data && item.data.user) {
        const user = item.data.user
        if (!userMap.has(user.id)) {
          userMap.set(user.id, {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            lastSeen: new Date(item.timestamp),
            orderCount: 1
          })
        } else {
          const existing = userMap.get(user.id)!
          existing.orderCount += 1
          if (new Date(item.timestamp) > existing.lastSeen) {
            existing.lastSeen = new Date(item.timestamp)
          }
        }
      }
    })

    return Array.from(userMap.values())
  }, [activity])

  // Filter users based on search and role
  const getFilteredUsers = useCallback((): UserInfo[] => {
    let users = getUniqueUsers()

    if (userSearch) {
      const searchLower = userSearch.toLowerCase()
      users = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        u.email.toLowerCase().includes(searchLower)
      )
    }

    if (userRoleFilter !== 'ALL') {
      users = users.filter(u => u.role === userRoleFilter)
    }

    // Sort by last seen (most recent first)
    return users.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
  }, [getUniqueUsers, userSearch, userRoleFilter])

  const filteredUsers = getFilteredUsers()

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'error'
      case 'ORGANIZER':
        return 'warning'
      case 'ATTENDEE':
        return 'info'
      default:
        return 'neutral'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador'
      case 'ORGANIZER':
        return 'Organizador'
      case 'ATTENDEE':
        return 'Participante'
      default:
        return role
    }
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-lg p-3">
          <p className="text-sm font-medium text-neutral-900 mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'Receita' ? formatCurrency(entry.value) : formatNumber(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading && !stats) {
    return (
      <AdminAppShell>
        <main className="max-w-7xl mx-auto p-6 space-y-6" aria-live="polite" aria-busy="true">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center">
            <div className="h-8 bg-neutral-200 rounded animate-pulse w-64" />
            <div className="h-10 bg-neutral-200 rounded animate-pulse w-40" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>

          {/* Charts Skeleton */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="h-6 bg-neutral-200 rounded animate-pulse w-48 mb-4" />
            <div className="h-80 bg-neutral-200 rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-48 mb-4" />
              <div className="h-64 bg-neutral-200 rounded animate-pulse" />
            </div>
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-48 mb-4" />
              <div className="h-64 bg-neutral-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Activity Table Skeleton */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="h-6 bg-neutral-200 rounded animate-pulse w-48 mb-4" />
            <SkeletonTable rowCount={5} columnCount={3} />
          </div>
        </main>
      </AdminAppShell>
    )
  }

  return (
    <AdminAppShell>
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl md:text-2xl font-display font-bold text-neutral-900">Dashboard de Administração</h1>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="w-full sm:w-auto px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
        {error && (
          <ErrorState
            title="Erro ao Carregar Dashboard"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchData()}
          />
        )}

        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Stat
                label="Receita Total"
                value={formatCurrency(stats.totalRevenue)}
                trend={{ value: '0%', direction: 'neutral' }}
              />

              <Stat
                label="Pedidos Totais"
                value={formatNumber(stats.totalOrders)}
                trend={{ value: '0%', direction: 'neutral' }}
              />

              <Stat
                label="Ingressos Totais"
                value={formatNumber(stats.totalTickets)}
                trend={{ value: '0%', direction: 'neutral' }}
              />

              <Stat
                label="Organizadores Totais"
                value={formatNumber(stats.totalOrganizers)}
                trend={{ value: '0%', direction: 'neutral' }}
              />

              <Stat
                label="Organizadores Ativos"
                value={formatNumber(stats.activeOrganizers)}
                trend={{ value: '0%', direction: 'neutral' }}
              />

              <Stat
                label="Eventos Ativos"
                value={formatNumber(stats.activeEvents)}
                trend={{ value: '0%', direction: 'neutral' }}
              />

              <Stat
                label="Total de Eventos"
                value={formatNumber(stats.totalEvents)}
                trend={{ value: '0%', direction: 'neutral' }}
              />
            </div>
          </>
        )}

        {/* Charts Section */}
        {timeSeries && (
          <div className="space-y-6 mb-8">
            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900">
                  Receita ao Longo do Tempo
                </h2>
                <div className="text-sm text-neutral-600">
                  Média diária: {formatCurrency(timeSeries.summary.avgDailyRevenue)}
                </div>
              </div>
              <div className="h-64 md:h-80">
                <Suspense fallback={<div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />}>
                  <AdminRevenueChart
                    data={timeSeries.daily}
                    formatDate={formatDate}
                    formatCurrency={formatCurrency}
                    CustomTooltip={CustomTooltip}
                  />
                </Suspense>
              </div>
            </div>

            {/* Orders and Tickets Chart */}
            <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900">
                  Pedidos e Ingressos
                </h2>
                <div className="text-sm text-neutral-600">
                  Média diária: {formatNumber(timeSeries.summary.avgDailyOrders)} pedidos
                </div>
              </div>
              <div className="h-64 md:h-80">
                <Suspense fallback={<div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />}>
                  <AdminOrdersChart
                    data={timeSeries.daily}
                    formatDate={formatDate}
                    CustomTooltip={CustomTooltip}
                  />
                </Suspense>
              </div>
            </div>

            {/* Line chart for trends */}
            <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6">
              <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900 mb-4">
                Tendências
              </h2>
              <div className="h-64 md:h-80">
                <Suspense fallback={<div className="h-64 md:h-80 bg-neutral-100 animate-pulse rounded-xl" />}>
                  <AdminTrendsChart
                    data={timeSeries.daily}
                    formatDate={formatDate}
                    CustomTooltip={CustomTooltip}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {disputes && (
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900 mb-4">
              Estatísticas de Disputas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-warning-50 rounded-xl p-3 md:p-4 border border-warning-200">
                <h4 className="text-xs md:text-sm font-medium text-warning-800 mb-1">
                  Pendentes
                </h4>
                <div className="text-xl md:text-2xl font-bold text-warning-600">
                  {formatNumber(disputes.pending)}
                </div>
              </div>

              <div className="bg-success-50 rounded-xl p-3 md:p-4 border border-success-200">
                <h4 className="text-xs md:text-sm font-medium text-success-800 mb-1">
                  Resolvidas
                </h4>
                <div className="text-xl md:text-2xl font-bold text-success-600">
                  {formatNumber(disputes.resolved)}
                </div>
              </div>

              <div className="bg-error-50 rounded-xl p-3 md:p-4 border border-error-200">
                <h4 className="text-xs md:text-sm font-medium text-error-800 mb-1">
                  Escalonadas
                </h4>
                <div className="text-xl md:text-2xl font-bold text-error-600">
                  {formatNumber(disputes.escalated)}
                </div>
              </div>

              <div className="bg-primary-50 rounded-xl p-3 md:p-4 border border-primary-200">
                <h4 className="text-xs md:text-sm font-medium text-primary-800 mb-1">
                  Tempo Médio
                </h4>
                <div className="text-xl md:text-2xl font-bold text-primary-600">
                  {disputes.avgResolutionTime.toFixed(1)} dias
                </div>
              </div>
            </div>
          </div>
        )}

        {anticipations && (
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900 mb-4">
              Antecipações de Repasse
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
              <div className="bg-warning-50 rounded-xl p-3 md:p-4 border border-warning-200">
                <h4 className="text-xs md:text-sm font-medium text-warning-800 mb-1">
                  Pendentes
                </h4>
                <div className="text-xl md:text-2xl font-bold text-warning-600">
                  {formatNumber(anticipations.pending)}
                </div>
              </div>

              <div className="bg-success-50 rounded-xl p-3 md:p-4 border border-success-200">
                <h4 className="text-xs md:text-sm font-medium text-success-800 mb-1">
                  Aprovadas
                </h4>
                <div className="text-xl md:text-2xl font-bold text-success-600">
                  {formatNumber(anticipations.approved)}
                </div>
              </div>

              <div className="bg-error-50 rounded-xl p-3 md:p-4 border border-error-200">
                <h4 className="text-xs md:text-sm font-medium text-error-800 mb-1">
                  Rejeitadas
                </h4>
                <div className="text-xl md:text-2xl font-bold text-error-600">
                  {formatNumber(anticipations.rejected)}
                </div>
              </div>
            </div>

            <div className="text-sm text-neutral-600">
              Tempo médio de processamento: {anticipations.avgProcessingTime.toFixed(1)} dias
            </div>
          </div>
        )}

        {activity.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6 mb-8">
            <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900 mb-4">
              Atividade Recente
            </h2>
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="px-4 md:px-0">
                <Table
                  columns={[
                    {
                      key: 'timestamp',
                      label: 'Data/Hora',
                      render: (_, row) => {
                        const date = new Date(row.timestamp)
                        return date.toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      }
                    },
                    {
                      key: 'type',
                      label: 'Ação',
                      render: (_, row) => {
                        const actionMap: Record<string, string> = {
                          'USER_LOGIN': 'Login de usuário',
                          'USER_REGISTER': 'Novo usuário',
                          'ORDER_CREATED': 'Novo pedido',
                          'PAYMENT_PROCESSED': 'Pagamento processado',
                          'TICKET_CHECKED_IN': 'Check-in realizado',
                          'EVENT_CREATED': 'Evento criado',
                          'REFUND_PROCESSED': 'Reembolso processado',
                        }
                        return <Badge variant="info">{actionMap[row.type] || row.type}</Badge>
                      }
                    },
                    {
                      key: 'data',
                      label: 'Detalhes',
                      render: (_, row) => (
                        <span className="text-sm text-neutral-700 max-w-md truncate inline-block">
                          {JSON.stringify(row.data)}
                        </span>
                      )
                    }
                  ]}
                  data={activity}
                  caption="Atividade recente do sistema"
                />
              </div>
            </div>
          </div>
        )}

        {/* User Management Section */}
        <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 md:p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <h2 className="text-base md:text-lg font-display font-semibold text-neutral-900">
              Usuários Ativos
            </h2>
            <div className="text-sm text-neutral-600">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'} encontrados
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="user-search" className="block text-sm font-medium text-neutral-700 mb-2">
                Buscar por nome ou email
              </label>
              <input
                id="user-search"
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Digite para buscar..."
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Buscar usuários"
              />
            </div>

            <div>
              <label htmlFor="role-filter" className="block text-sm font-medium text-neutral-700 mb-2">
                Filtrar por papel
              </label>
              <select
                id="role-filter"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as typeof userRoleFilter)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Filtrar por papel"
              >
                <option value="ALL">Todos os papéis</option>
                <option value="ADMIN">Administradores</option>
                <option value="ORGANIZER">Organizadores</option>
                <option value="ATTENDEE">Participantes</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-neutral-600">
              Nenhum usuário encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="px-4 md:px-0">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900">Nome</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900">Papel</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900">Pedidos</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-900">Última Atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className="py-3 px-4 text-sm text-neutral-900">{user.name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-neutral-700">{user.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-700">{user.orderCount}</td>
                        <td className="py-3 px-4 text-sm text-neutral-700">{formatDateTime(user.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* User Stats Summary */}
          {filteredUsers.length > 0 && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pt-6 border-t border-neutral-200">
              <div className="bg-neutral-50/80 rounded-xl p-3">
                <div className="text-xs text-neutral-600 mb-1">Total Exibido</div>
                <div className="text-lg font-semibold text-neutral-900">{filteredUsers.length}</div>
              </div>
              <div className="bg-neutral-50/80 rounded-xl p-3">
                <div className="text-xs text-neutral-600 mb-1">Administradores</div>
                <div className="text-lg font-semibold text-neutral-900">
                  {filteredUsers.filter(u => u.role === 'ADMIN').length}
                </div>
              </div>
              <div className="bg-neutral-50/80 rounded-xl p-3">
                <div className="text-xs text-neutral-600 mb-1">Organizadores</div>
                <div className="text-lg font-semibold text-neutral-900">
                  {filteredUsers.filter(u => u.role === 'ORGANIZER').length}
                </div>
              </div>
              <div className="bg-neutral-50/80 rounded-xl p-3">
                <div className="text-xs text-neutral-600 mb-1">Participantes</div>
                <div className="text-lg font-semibold text-neutral-900">
                  {filteredUsers.filter(u => u.role === 'ATTENDEE').length}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </AdminAppShell>
  )
}
