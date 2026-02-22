'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { Stat } from '@/components/ui/stat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SkeletonStat, SkeletonTable } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { DollarSign, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react'

interface PayoutRequest {
  id?: string
  totalSales: number
  totalFees: number
  netAmount: number
  anticipationAmount?: number
  anticipationFee?: number
  bankTransferFee?: number
  finalPayout: number
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'
  scheduledFor?: string
  processedAt?: string
  event?: {
    id: string
    title: string
  }
  createdAt?: string
}

interface PayoutsStats {
  totalPaid: number
  totalPending: number
  totalFees: number
  nextPayoutDate?: string
}

const statusConfig = {
  PENDING: { label: 'Pendente', variant: 'warning' as const, icon: Clock },
  APPROVED: { label: 'Aprovado', variant: 'info' as const, icon: CheckCircle },
  PAID: { label: 'Pago', variant: 'success' as const, icon: CheckCircle },
  CANCELLED: { label: 'Cancelado', variant: 'neutral' as const, icon: XCircle },
}

export default function PayoutsPage() {
  const router = useRouter()
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [stats, setStats] = useState<PayoutsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [payoutToCancel, setPayoutToCancel] = useState<PayoutRequest | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/payouts')
      const data = await response.json()

      if (response.ok) {
        setPayouts(data.payouts || [])

        // Calculate stats from payouts
        const calculatedStats: PayoutsStats = {
          totalPaid: 0,
          totalPending: 0,
          totalFees: 0,
          nextPayoutDate: undefined,
        }

        const pendingPayouts: string[] = []

        for (const payout of data.payouts || []) {
          if (payout.status === 'PAID') {
            calculatedStats.totalPaid += payout.finalPayout
          } else if (payout.status === 'PENDING' || payout.status === 'APPROVED') {
            calculatedStats.totalPending += payout.finalPayout
            if (payout.scheduledFor) {
              pendingPayouts.push(payout.scheduledFor)
            }
          }
          calculatedStats.totalFees += payout.totalFees
        }

        // Find the next payout date (earliest scheduled date)
        if (pendingPayouts.length > 0) {
          calculatedStats.nextPayoutDate = pendingPayouts.sort((a, b) =>
            new Date(a).getTime() - new Date(b).getTime()
          )[0]
        }

        setStats(calculatedStats)
      } else {
        setError(data.error || 'Erro ao carregar repasses')
      }
    } catch (err) {
      setError('Erro ao carregar repasses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayouts()
  }, [fetchPayouts])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const handleCancelPayout = async () => {
    if (!payoutToCancel) return

    try {
      setCancelling(true)
      const response = await fetch(`/api/payouts/${payoutToCancel.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setCancelModalOpen(false)
        setPayoutToCancel(null)
        fetchPayouts()
      } else {
        setError(data.error || 'Erro ao cancelar repasse')
      }
    } catch (err) {
      setError('Erro ao cancelar repasse')
    } finally {
      setCancelling(false)
    }
  }

  const openCancelModal = (payout: PayoutRequest) => {
    if (payout.status === 'PAID') {
      setError('Não é possível cancelar um repasse já pago')
      return
    }
    setPayoutToCancel(payout)
    setCancelModalOpen(true)
  }

  const handleRowClick = (payout: PayoutRequest) => {
    if (payout.id) {
      router.push(`/organizer/payouts/${payout.id}`)
    }
  }

  const getStatusBadge = (status: keyof typeof statusConfig) => {
    const config = statusConfig[status]
    const Icon = config.icon
    return (
      <div className="flex items-center gap-2">
        <Badge variant={config.variant}>
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </div>
    )
  }

  if (loading && !payouts.length) {
    return (
      <OrganizerAppShell>
        <main className="space-y-6" aria-live="polite" aria-busy="true">
          {/* Page Header Skeleton */}
          <div className="h-8 bg-neutral-200 rounded animate-pulse w-48" />

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>

          {/* Table Skeleton */}
          <SkeletonTable rowCount={5} columnCount={5} />
        </main>
      </OrganizerAppShell>
    )
  }

  const columns = [
    {
      key: 'event',
      label: 'Evento',
      render: (_: any, row: PayoutRequest) => row.event?.title || 'Todos os eventos',
    },
    {
      key: 'totalSales',
      label: 'Vendas',
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'totalFees',
      label: 'Taxas',
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'finalPayout',
      label: 'Valor Líquido',
      render: (value: number) => (
        <span className="font-semibold text-success-600">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, row: PayoutRequest) => getStatusBadge(row.status),
    },
    {
      key: 'scheduledFor',
      label: 'Data Prevista',
      render: (value: string) => formatDate(value),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_: any, row: PayoutRequest) => (
        <div className="flex items-center gap-2">
          {row.status !== 'PAID' && row.status !== 'CANCELLED' && (
            <button
              onClick={() => openCancelModal(row)}
              className="text-error-600 hover:text-error-800 transition-colors"
              aria-label={`Cancelar repasse de ${formatCurrency(row.finalPayout)}`}
              title="Cancelar repasse"
            >
              <Trash2 className="w-[1rem] h-[1rem]" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <OrganizerAppShell>
      <main className="space-y-8 animate-fade-in">
        {error && (
          <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-lg flex items-center gap-2" role="alert">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900">Repasses</h1>
          <p className="text-neutral-600 mt-2">
            Acompanhe seus repasses e histórico de pagamentos
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat
              label="Total Recebido"
              value={formatCurrency(stats.totalPaid)}
            />
            <Stat
              label="Pendente"
              value={formatCurrency(stats.totalPending)}
            />
            <Stat
              label="Total em Taxas"
              value={formatCurrency(stats.totalFees)}
            />
            <Stat
              label="Próximo Repasse"
              value={stats.nextPayoutDate ? formatDate(stats.nextPayoutDate) : 'N/A'}
            />
          </div>
        )}

        {/* Payouts Table */}
        <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
          <CardHeader>
            <CardTitle className="font-display">Histórico de Repasses</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600">Nenhum repasse encontrado</p>
                <p className="text-neutral-600 text-sm mt-2">
                  Os repasses aparecerão aqui após você tiver vendas aprovadas
                </p>
              </div>
            ) : (
              <Table
                columns={columns}
                data={payouts}
                caption="Histórico de repasses do organizador"
                onRowClick={handleRowClick}
              />
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-info-50 border-info-200 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-info-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-semibold text-info-900 mb-2">
                  Informações sobre Repasses
                </h3>
                <ul className="text-sm text-info-800 space-y-4">
                  <li>• Repasses são processados dentro de 3 dias úteis após o evento</li>
                  <li>• Taxas são deduzidas automaticamente do valor total das vendas</li>
                  <li>• Repasses pendentes podem ser cancelados a qualquer momento</li>
                  <li>• Antecipações de repasse estão sujeitas a taxas adicionais</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancelar Repasse"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            Tem certeza que deseja cancelar este repasse de{' '}
            <span className="font-semibold text-neutral-900">
              {payoutToCancel && formatCurrency(payoutToCancel.finalPayout)}
            </span>
            ?
          </p>
          <p className="text-sm text-neutral-600">
            Esta ação não pode ser desfeita. O valor ficará disponível para um novo pedido de repasse.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
            >
              Manter Repasse
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelPayout}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelando...' : 'Cancelar Repasse'}
            </Button>
          </div>
        </div>
      </Modal>
    </OrganizerAppShell>
  )
}
