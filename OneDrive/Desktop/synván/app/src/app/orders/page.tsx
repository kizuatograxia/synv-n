'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AuthenticatedAppShell } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Table, Column } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Ticket } from 'lucide-react'
import Link from 'next/link'
import type { ApiError } from '@/hooks/useApi'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/utils/format'

type PaymentStatus = 'ALL' | 'APPROVED' | 'PENDING' | 'REFUNDED'
type SortDirection = 'asc' | 'desc'

interface Order {
  id: string
  totalAmount: number
  paymentStatus: string
  refundRequested: boolean
  refundApproved: boolean
  createdAt: string
  event: {
    title: string
    startTime: string
    location?: string
  }
  tickets: Array<any>
}

export default function OrdersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [filter, setFilter] = useState<PaymentStatus>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const fetchOrders = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/orders')
      const data = await response.json()

      if (response.ok) {
        setOrders(data.orders)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar pedidos',
          status: response.status,
          code: data.code
        }
        setError(apiError)
      }
    } catch (error) {
      const apiError: ApiError = {
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        status: undefined
      }
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      fetchOrders()
    }
  }, [session, fetchOrders])

  // Filter, sort, and paginate orders
  const processedOrders = useMemo(() => {
    let filtered = orders

    // Apply status filter
    if (filter !== 'ALL') {
      filtered = filtered.filter((o) => o.paymentStatus === filter)
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortColumn) {
        case 'eventTitle':
          aValue = a.event.title.toLowerCase()
          bValue = b.event.title.toLowerCase()
          break
        case 'eventDate':
          aValue = new Date(a.event.startTime).getTime()
          bValue = new Date(b.event.startTime).getTime()
          break
        case 'totalAmount':
          aValue = a.totalAmount
          bValue = b.totalAmount
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          return 0
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

    return filtered
  }, [orders, filter, sortColumn, sortDirection])

  // Calculate pagination
  const totalPages = Math.ceil(processedOrders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedOrders = processedOrders.slice(startIndex, startIndex + pageSize)

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column)
    setSortDirection(direction)
  }

  const handleRowClick = (order: Order) => {
    router.push(`/orders/${order.id}`)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleFilterChange = (newFilter: PaymentStatus) => {
    setFilter(newFilter)
    setCurrentPage(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'APPROVED':
        return 'success'
      case 'PENDING':
        return 'warning'
      case 'REFUNDED':
        return 'info'
      default:
        return 'error'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'Aprovado'
      case 'PENDING':
        return 'Pendente'
      case 'REFUNDED':
        return 'Reembolsado'
      default:
        return 'Recusado'
    }
  }

  // Define table columns
  const columns: Column<Order>[] = [
    {
      key: 'eventTitle',
      label: 'Evento',
      sortable: true,
      render: (_value, row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.event.title}</div>
          <div className="text-sm text-neutral-600">
            {row.tickets.length} {row.tickets.length === 1 ? 'ingresso' : 'ingressos'}
          </div>
        </div>
      ),
    },
    {
      key: 'eventDate',
      label: 'Data do Evento',
      sortable: true,
      render: (_value, row) => (
        <div className="text-sm text-neutral-900">
          {formatDate(row.event.startTime)}
          {row.event.location && (
            <div className="text-neutral-600 text-xs mt-1">📍 {row.event.location}</div>
          )}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      label: 'Valor',
      sortable: true,
      render: (value) => (
        <div className="font-medium text-neutral-900">{formatCurrency(value)}</div>
      ),
    },
    {
      key: 'paymentStatus',
      label: 'Status',
      sortable: false,
      render: (_value, row) => (
        <div className="flex flex-col gap-1">
          <Badge variant={getStatusVariant(row.paymentStatus)} size="sm">
            {getStatusText(row.paymentStatus)}
          </Badge>
          {row.refundRequested && !row.refundApproved && (
            <span className="text-xs text-warning-600">Reembolso solicitado</span>
          )}
          {row.refundApproved && (
            <span className="text-xs text-success-600">Reembolso aprovado</span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Data do Pedido',
      sortable: true,
      render: (value) => (
        <div className="text-sm text-neutral-900">{formatDateTime(value)}</div>
      ),
    },
  ]

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-card p-8 text-center max-w-md">
          <h1 className="text-2xl font-display font-bold text-neutral-900 mb-4">Acesso Negado</h1>
          <p className="text-neutral-600 mb-6">Você precisa estar logado para ver seus pedidos.</p>
          <Button
            onClick={() => router.push('/auth/login')}
            variant="primary"
          >
            Fazer Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <AuthenticatedAppShell>
      <main className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold text-neutral-900">Meus Pedidos</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'ALL' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('ALL')}
          >
            Todos
          </Button>
          <Button
            variant={filter === 'APPROVED' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('APPROVED')}
          >
            Aprovados
          </Button>
          <Button
            variant={filter === 'PENDING' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('PENDING')}
          >
            Pendentes
          </Button>
          <Button
            variant={filter === 'REFUNDED' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => handleFilterChange('REFUNDED')}
          >
            Reembolsados
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <ErrorState
            title="Erro ao Carregar Pedidos"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchOrders()}
          />
        ) : processedOrders.length === 0 ? (
          <EmptyState
            icon={<Ticket className="w-16 h-16" />}
            title="Nenhum pedido encontrado"
            description={
              filter === 'ALL'
                ? 'Você ainda não fez nenhuma compra.'
                : `Nenhum pedido com status "${getStatusText(filter)}" encontrado.`
            }
            action={{
              label: 'Explorar Eventos',
              onClick: () => router.push('/events')
            }}
          />
        ) : (
          <>
            <div className="bg-white shadow-card overflow-hidden rounded-2xl">
              <Table
                columns={columns}
                data={paginatedOrders}
                caption="Lista de pedidos do usuário com informações sobre evento, data, valor e status de pagamento"
                onSort={handleSort}
                onRowClick={handleRowClick}
                emptyMessage="Nenhum pedido encontrado"
              />
            </div>

            {totalPages > 1 && (
              <div className="bg-white px-6 py-4 rounded-2xl shadow-card">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={processedOrders.length}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  showPageSizeSelector
                  showTotalItems
                />
              </div>
            )}
          </>
        )}
      </main>
    </AuthenticatedAppShell>
  )
}
