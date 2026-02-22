'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { AdminAppShell } from '@/components/layout/app-shell'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'

interface ActivityItem {
  type: string
  data: any
  timestamp: Date
}

interface UserInfo {
  id: string
  name: string | null
  email: string
  role: string
  lastSeen: Date
  orderCount: number
}

export default function AdminUsersPage() {
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'ORGANIZER' | 'ATTENDEE'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const fetchActivity = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/admin/dashboard')
      const data = await response.json()

      if (response.ok) {
        setActivity(data.activity || [])
      } else {
        setError(data.error || 'Erro ao carregar dados')
      }
    } catch (err) {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

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

  // Filter users based on search, role, and status
  const getFilteredUsers = useCallback((): UserInfo[] => {
    let users = getUniqueUsers()

    if (search) {
      const searchLower = search.toLowerCase()
      users = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        u.email.toLowerCase().includes(searchLower)
      )
    }

    if (roleFilter !== 'ALL') {
      users = users.filter(u => u.role === roleFilter)
    }

    if (statusFilter !== 'ALL') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      if (statusFilter === 'ACTIVE') {
        users = users.filter(u => u.lastSeen > thirtyDaysAgo)
      } else {
        users = users.filter(u => u.lastSeen <= thirtyDaysAgo)
      }
    }

    // Sort by last seen (most recent first)
    return users.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
  }, [getUniqueUsers, search, roleFilter, statusFilter])

  const filteredUsers = getFilteredUsers()

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, pageSize])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, roleFilter, statusFilter, pageSize])

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

  const getUserStatus = (lastSeen: Date) => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return lastSeen > thirtyDaysAgo ? 'Ativo' : 'Inativo'
  }

  const getStatusBadgeVariant = (lastSeen: Date) => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return lastSeen > thirtyDaysAgo ? 'success' : 'neutral'
  }

  if (loading) {
    return (
      <AdminAppShell>
        <main className="max-w-7xl mx-auto p-6 space-y-6" aria-live="polite" aria-busy="true">
          {/* Page Header Skeleton */}
          <div className="mb-6">
            <div className="h-8 bg-neutral-200 rounded animate-pulse w-64 mb-2" />
            <div className="h-5 bg-neutral-200 rounded animate-pulse w-96" />
          </div>

          {/* Filters Skeleton */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-10 bg-neutral-200 rounded animate-pulse flex-1 max-w-md" />
            <div className="h-10 bg-neutral-200 rounded animate-pulse w-40" />
            <div className="h-10 bg-neutral-200 rounded animate-pulse w-40" />
          </div>

          {/* Table Skeleton */}
          <SkeletonTable rowCount={10} columnCount={6} />
        </main>
      </AdminAppShell>
    )
  }

  return (
    <AdminAppShell>
      <main className="max-w-7xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-neutral-900 mb-2">
            Gerenciamento de Usuários
          </h1>
          <p className="text-neutral-600">
            Visualize e gerencie todos os usuários da plataforma
          </p>
        </div>

        {error && (
          <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-xl mb-6" role="alert">
            {error}
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4">
            <div className="text-sm text-neutral-600 mb-1">Total de Usuários</div>
            <div className="text-2xl font-semibold text-neutral-900">
              {getUniqueUsers().length}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4">
            <div className="text-sm text-neutral-600 mb-1">Administradores</div>
            <div className="text-2xl font-semibold text-error-600">
              {getUniqueUsers().filter(u => u.role === 'ADMIN').length}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4">
            <div className="text-sm text-neutral-600 mb-1">Organizadores</div>
            <div className="text-2xl font-semibold text-warning-600">
              {getUniqueUsers().filter(u => u.role === 'ORGANIZER').length}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4">
            <div className="text-sm text-neutral-600 mb-1">Participantes</div>
            <div className="text-2xl font-semibold text-primary-600">
              {getUniqueUsers().filter(u => u.role === 'ATTENDEE').length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-card border border-neutral-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-neutral-700 mb-2">
                Buscar
              </label>
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou email..."
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Buscar usuários por nome ou email"
              />
            </div>

            <div>
              <label htmlFor="role-filter" className="block text-sm font-medium text-neutral-700 mb-2">
                Papel
              </label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Filtrar por papel"
              >
                <option value="ALL">Todos os papéis</option>
                <option value="ADMIN">Administradores</option>
                <option value="ORGANIZER">Organizadores</option>
                <option value="ATTENDEE">Participantes</option>
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-neutral-700 mb-2">
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Filtrar por status"
              >
                <option value="ALL">Todos os status</option>
                <option value="ACTIVE">Ativos (30 dias)</option>
                <option value="INACTIVE">Inativos (30+ dias)</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-neutral-600">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'} encontrado{filteredUsers.length !== 1 ? 's' : ''}
            {filteredUsers.length > pageSize && (
              <span className="ml-2">({totalPages} {totalPages === 1 ? 'página' : 'páginas'})</span>
            )}
          </div>
        </div>

        {/* Users Table */}
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16" />}
            title="Nenhum usuário encontrado"
            description="Não há usuários que correspondam aos filtros selecionados."
            action={{
              label: 'Limpar filtros',
              onClick: () => {
                setSearch('')
                setRoleFilter('ALL')
                setStatusFilter('ALL')
              }
            }}
          />
        ) : (
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200">
            <Table
              columns={[
                {
                  key: 'name',
                  label: 'Nome',
                  sortable: true,
                  render: (_, row) => (
                    <span className="font-medium text-neutral-900">
                      {row.name || <span className="text-neutral-600 italic">Sem nome</span>}
                    </span>
                  )
                },
                {
                  key: 'email',
                  label: 'Email',
                  sortable: true,
                  render: (value) => (
                    <span className="text-neutral-700">{value}</span>
                  )
                },
                {
                  key: 'role',
                  label: 'Papel',
                  sortable: true,
                  render: (_, row) => (
                    <Badge variant={getRoleBadgeVariant(row.role)}>
                      {getRoleLabel(row.role)}
                    </Badge>
                  )
                },
                {
                  key: 'orderCount',
                  label: 'Pedidos',
                  sortable: true,
                  render: (value) => (
                    <span className="text-neutral-700">{value}</span>
                  )
                },
                {
                  key: 'lastSeen',
                  label: 'Última Atividade',
                  sortable: true,
                  render: (_, row) => (
                    <div className="space-y-1">
                      <div className="text-sm text-neutral-700">{formatDateTime(row.lastSeen)}</div>
                      <Badge variant={getStatusBadgeVariant(row.lastSeen)} size="sm">
                        {getUserStatus(row.lastSeen)}
                      </Badge>
                    </div>
                  )
                },
                {
                  key: 'status',
                  label: 'Status',
                  sortable: true,
                  render: (_, row) => (
                    <Badge variant={getStatusBadgeVariant(row.lastSeen)}>
                      {getUserStatus(row.lastSeen)}
                    </Badge>
                  )
                }
              ]}
              data={paginatedUsers}
              caption="Lista de usuários da plataforma"
            />
          </div>
        )}

        {/* Pagination */}
        {filteredUsers.length > pageSize && (
          <div className="mt-6 bg-white rounded-2xl shadow-card border border-neutral-200 p-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCurrentPage(1)
              }}
              totalItems={filteredUsers.length}
              showPageSizeSelector={true}
              showTotalItems={true}
            />
          </div>
        )}
      </main>
    </AdminAppShell>
  )
}
