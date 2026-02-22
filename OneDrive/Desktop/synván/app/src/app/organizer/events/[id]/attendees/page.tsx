'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { Table } from '@/components/ui/table'
import { useToast } from '@/hooks/useToast'
import type { ApiError } from '@/hooks/useApi'
import { getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Users, Search, Download, ArrowLeft, Calendar, Ticket, CheckCircle, XCircle, Clock, Mail, Phone } from 'lucide-react'
import { cn } from '@/lib/cn'

interface TicketData {
  id: string
  code: string
  type: string
  price: number
  isUsed: boolean
  lotName: string
}

interface AttendeeData {
  id: string
  orderCode: string
  attendeeName: string
  attendeeEmail: string
  attendeePhone: string | null
  tickets: TicketData[]
  totalAmount: number
  paymentMethod: string
  paymentStatus: string
  createdAt: string
}

type PaymentStatus = 'PENDING' | 'APPROVED' | 'REFUNDED' | 'FAILED'
type TicketType = 'GENERAL' | 'MEIA_ENTRADA' | 'VIP'

const paymentStatusConfig: Record<PaymentStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral'; icon: any }> = {
  PENDING: { label: 'Pendente', variant: 'neutral', icon: Clock },
  APPROVED: { label: 'Aprovado', variant: 'success', icon: CheckCircle },
  REFUNDED: { label: 'Reembolsado', variant: 'warning', icon: XCircle },
  FAILED: { label: 'Falhou', variant: 'error', icon: XCircle },
}

const ticketTypeLabels: Record<TicketType, string> = {
  GENERAL: 'Geral',
  MEIA_ENTRADA: 'Meia-Entrada',
  VIP: 'VIP',
}

export default function EventAttendeesPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()

  const [attendees, setAttendees] = useState<AttendeeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [exporting, setExporting] = useState(false)

  const fetchAttendees = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch orders for this event
      const response = await fetch(`/api/orders?eventId=${params.id}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao carregar participantes')
      }

      const data = await response.json()

      // Transform orders into attendee data
      const attendeeData: AttendeeData[] = data.orders.map((order: any) => {
        // Extract attendee info from order user
        const attendeeName = order.user?.name || 'Não informado'
        const attendeeEmail = order.user?.email || 'Não informado'
        const attendeePhone = order.user?.phone || null

        // Extract ticket information
        const tickets: TicketData[] = order.tickets.map((ticket: any) => ({
          id: ticket.id,
          code: ticket.code,
          type: ticketTypeLabels[ticket.type as TicketType] || ticket.type,
          price: ticket.price,
          isUsed: ticket.isUsed,
          lotName: ticket.lot?.name || 'N/A',
        }))

        return {
          id: order.id,
          orderCode: order.id.slice(0, 8).toUpperCase(),
          attendeeName,
          attendeeEmail,
          attendeePhone,
          tickets,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
        }
      })

      setAttendees(attendeeData)
      setError(null)
    } catch (err) {
      const apiError: ApiError = {
        message: err instanceof Error ? err.message : 'Erro de conexão. Verifique sua internet e tente novamente.',
        status: undefined
      }
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchAttendees()
  }, [fetchAttendees])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return 'Não informado'
    // Format Brazilian phone: +55 XX XXXXX-XXXX
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13) {
      return `+55 ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
    }
    return phone
  }

  // Filter attendees based on search and status
  const filteredAttendees = useMemo(() => {
    return attendees.filter(attendee => {
      // Status filter
      if (statusFilter !== 'all' && attendee.paymentStatus !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          attendee.attendeeName.toLowerCase().includes(query) ||
          attendee.attendeeEmail.toLowerCase().includes(query) ||
          attendee.orderCode.toLowerCase().includes(query) ||
          attendee.tickets.some(t => t.code.toLowerCase().includes(query))
        )
      }

      return true
    })
  }, [attendees, searchQuery, statusFilter])

  // Statistics
  const stats = useMemo(() => {
    const totalAttendees = attendees.length
    const checkedIn = attendees.reduce((sum, a) => sum + a.tickets.filter(t => t.isUsed).length, 0)
    const totalTickets = attendees.reduce((sum, a) => sum + a.tickets.length, 0)
    const totalRevenue = attendees.reduce((sum, a) => {
      return a.paymentStatus === 'APPROVED' ? sum + a.totalAmount : sum
    }, 0)

    return { totalAttendees, checkedIn, totalTickets, totalRevenue }
  }, [attendees])

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    setExporting(true)
    try {
      // Create CSV header
      const headers = [
        'Código do Pedido',
        'Nome do Participante',
        'Email',
        'Telefone',
        'Código do Ingresso',
        'Tipo de Ingresso',
        'Lote',
        'Preço',
        'Status do Pagamento',
        'Check-in',
        'Data da Compra',
      ]

      // Create CSV rows
      const rows = filteredAttendees.flatMap(attendee => {
        return attendee.tickets.map(ticket => {
          const statusConfig = paymentStatusConfig[attendee.paymentStatus as PaymentStatus]
          return [
            attendee.orderCode,
            attendee.attendeeName,
            attendee.attendeeEmail,
            formatPhone(attendee.attendeePhone),
            ticket.code,
            ticket.type,
            ticket.lotName,
            formatCurrency(ticket.price),
            statusConfig.label,
            ticket.isUsed ? 'Sim' : 'Não',
            formatDate(attendee.createdAt),
          ]
        })
      })

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      const eventName = attendees[0]?.attendeeName || 'evento'
      const timestamp = new Date().toISOString().slice(0, 10)
      link.setAttribute('href', url)
      link.setAttribute('download', `participantes-${eventName}-${timestamp}.csv`)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Lista de participantes exportada com sucesso!')
    } catch (err) {
      toast.error('Erro ao exportar lista de participantes')
    } finally {
      setExporting(false)
    }
  }, [filteredAttendees, attendees, toast])

  // Table columns
  const columns = [
    {
      key: 'orderCode',
      label: 'Pedido',
      sortable: false,
      render: (value: string) => (
        <span className="font-mono text-sm text-neutral-600">{value}</span>
      ),
    },
    {
      key: 'attendeeName',
      label: 'Nome',
      sortable: false,
    },
    {
      key: 'attendeeEmail',
      label: 'Email',
      sortable: false,
      render: (value: string) => (
        <div className="flex items-center gap-2">
          <Mail className="w-[1rem] h-[1rem] text-neutral-400 flex-shrink-0" />
          <span className="text-sm text-neutral-600 truncate max-w-[200px]">{value}</span>
        </div>
      ),
    },
    {
      key: 'tickets',
      label: 'Ingressos',
      sortable: false,
      render: (tickets: TicketData[]) => (
        <div className="space-y-1">
          {tickets.map(ticket => (
            <div key={ticket.id} className="flex items-center gap-2 text-sm">
              <Badge
                variant={ticket.isUsed ? 'success' : 'neutral'}
                size="sm"
              >
                {ticket.isUsed ? 'Check-in' : 'Pendente'}
              </Badge>
              <span className="text-neutral-600">{ticket.lotName}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      label: 'Total',
      sortable: false,
      render: (value: number) => (
        <span className="font-medium text-neutral-900">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'paymentStatus',
      label: 'Status',
      sortable: false,
      render: (value: string) => {
        const config = paymentStatusConfig[value as PaymentStatus]
        const Icon = config.icon
        return (
          <Badge variant={config.variant} size="sm">
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        )
      },
    },
    {
      key: 'createdAt',
      label: 'Data da Compra',
      sortable: false,
      render: (value: string) => (
        <span className="text-sm text-neutral-600">{formatDate(value)}</span>
      ),
    },
  ]

  if (loading) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Participantes"
          subtitle="Visualize e gerencie os participantes do evento"
        />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div>
            <SkeletonCard />
          </div>
        </div>
      </OrganizerAppShell>
    )
  }

  if (error) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Participantes"
          subtitle="Visualize e gerencie os participantes do evento"
        />
        <ErrorState
          title="Erro ao Carregar Participantes"
          message={getErrorMessageFromError(error)}
          variant={getErrorVariantFromStatus(error.status)}
          onRetry={() => fetchAttendees()}
          onGoBack={() => router.push('/organizer/events')}
        />
      </OrganizerAppShell>
    )
  }

  return (
    <OrganizerAppShell>
      <main className="space-y-6">
        <PageHeader
          title="Participantes"
          subtitle="Visualize e gerencie os participantes do evento"
          breadcrumbs={[
            { label: 'Meus Eventos', href: '/organizer/events' },
            { label: 'Participantes' },
          ]}
        />

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Total de Pedidos</p>
                <p className="text-2xl font-bold font-display text-neutral-900">
                  {stats.totalAttendees}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Ticket className="w-6 h-6 text-secondary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Total de Ingressos</p>
                <p className="text-2xl font-bold font-display text-neutral-900">
                  {stats.totalTickets}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Check-ins Realizados</p>
                <p className="text-2xl font-bold font-display text-success-600">
                  {stats.checkedIn}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Receita Total</p>
                <p className="text-2xl font-bold font-display text-success-600">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <Input
                type="text"
                placeholder="Buscar por nome, email, código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Buscar participantes"
              />
            </div>

            {/* Filters and Export */}
            <div className="flex items-center gap-4 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                aria-label="Filtrar por status"
              >
                <option value="all">Todos os Status</option>
                <option value="APPROVED">Aprovado</option>
                <option value="PENDING">Pendente</option>
                <option value="REFUNDED">Reembolsado</option>
                <option value="FAILED">Falhou</option>
              </select>

              {/* Export Button */}
              <Button
                variant="outline"
                size="md"
                onClick={handleExportCSV}
                disabled={exporting || filteredAttendees.length === 0}
                loading={exporting}
              >
                <Download className="w-[1rem] h-[1rem] mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-neutral-600">
            {filteredAttendees.length === attendees.length ? (
              <span>Mostrando todos os {attendees.length} pedidos</span>
            ) : (
              <span>
                Mostrando {filteredAttendees.length} de {attendees.length} pedidos
              </span>
            )}
          </div>
        </Card>

        {/* Attendees Table */}
        {filteredAttendees.length === 0 ? (
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title={searchQuery || statusFilter !== 'all' ? 'Nenhum participante encontrado' : 'Nenhum participante ainda'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Tente ajustar os filtros de busca ou status.'
                : 'Os participantes que comprarem ingressos aparecerão aqui.'
            }
            action={
              searchQuery || statusFilter !== 'all'
                ? {
                    label: 'Limpar Filtros',
                    onClick: () => {
                      setSearchQuery('')
                      setStatusFilter('all')
                    },
                  }
                : undefined
            }
          />
        ) : (
          <Table
            data={filteredAttendees}
            columns={columns}
            caption="Lista de participantes do evento"
          />
        )}
      </main>
    </OrganizerAppShell>
  )
}
