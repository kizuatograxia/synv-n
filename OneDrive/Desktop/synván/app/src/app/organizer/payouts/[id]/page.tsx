'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SkeletonTextBlock } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { downloadPayoutPDF } from '@/lib/pdf/payout-pdf'
import {
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  ArrowLeft,
  Building2,
  FileText,
  TrendingDown,
  TrendingUp,
  Download,
} from 'lucide-react'

interface PayoutDetail {
  id: string
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
  createdAt: string
  bankAccount?: {
    id: string
    bankName: string
    agency: string
    account: string
    accountType: string
    accountHolder: string
    cpf: string
    isDefault: boolean
    isVerified: boolean
  }
  event?: {
    id: string
    title: string
  }
  user: {
    id: string
    name: string
    email: string
  }
}

const statusConfig = {
  PENDING: { label: 'Pendente', variant: 'warning' as const, icon: Clock, description: 'Aguardando aprovação' },
  APPROVED: { label: 'Aprovado', variant: 'info' as const, icon: CheckCircle, description: 'Aprovado para pagamento' },
  PAID: { label: 'Pago', variant: 'success' as const, icon: CheckCircle, description: 'Pagamento realizado' },
  CANCELLED: { label: 'Cancelado', variant: 'neutral' as const, icon: XCircle, description: 'Repasse cancelado' },
}

export default function PayoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [payout, setPayout] = useState<PayoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  const fetchPayout = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/payouts/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setPayout(data)
      } else {
        setError(data.error || 'Erro ao carregar repasse')
      }
    } catch (err) {
      setError('Erro ao carregar repasse')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchPayout()
    }
  }, [params.id])

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
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleCancelPayout = async () => {
    if (!payout) return

    try {
      setCancelling(true)
      const response = await fetch(`/api/payouts/${payout.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setCancelModalOpen(false)
        fetchPayout()
      } else {
        setError(data.error || 'Erro ao cancelar repasse')
      }
    } catch (err) {
      setError('Erro ao cancelar repasse')
    } finally {
      setCancelling(false)
    }
  }

  const openCancelModal = () => {
    if (payout?.status === 'PAID') {
      setError('Não é possível cancelar um repasse já pago')
      return
    }
    setCancelModalOpen(true)
  }

  const handleDownloadPDF = async () => {
    if (!payout) return

    setGeneratingPDF(true)
    try {
      await downloadPayoutPDF(payout)
      // Success feedback - PDF was downloaded
    } catch (error) {
      setError('Erro ao gerar PDF do repasse. Tente novamente.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  if (loading) {
    return (
      <OrganizerAppShell>
        <main className="space-y-6" aria-live="polite" aria-busy="true">
          {/* Back Button Skeleton */}
          <div className="h-10 bg-neutral-200 rounded animate-pulse w-40" />

          {/* Title Skeleton */}
          <div className="space-y-2">
            <div className="h-8 bg-neutral-200 rounded animate-pulse w-64" />
            <div className="h-6 bg-neutral-200 rounded animate-pulse w-48" />
          </div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-32 mb-4" />
              <SkeletonTextBlock lines={4} />
            </div>
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="h-6 bg-neutral-200 rounded animate-pulse w-32 mb-4" />
              <SkeletonTextBlock lines={4} />
            </div>
          </div>

          {/* Details Card Skeleton */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="h-6 bg-neutral-200 rounded animate-pulse w-48 mb-4" />
            <SkeletonTextBlock lines={6} />
          </div>
        </main>
      </OrganizerAppShell>
    )
  }

  if (error || !payout) {
    return (
      <OrganizerAppShell>
        <main className="space-y-8">
          <Button
            variant="outline"
            onClick={() => router.push('/organizer/payouts')}
            className="mb-4"
          >
            <ArrowLeft className="w-[1rem] h-[1rem] mr-2" />
            Voltar para Repasses
          </Button>
          <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-lg flex items-center gap-2" role="alert">
            <AlertCircle className="w-5 h-5" />
            {error || 'Repasse não encontrado'}
          </div>
        </main>
      </OrganizerAppShell>
    )
  }

  const statusInfo = statusConfig[payout.status]
  const StatusIcon = statusInfo.icon

  return (
    <OrganizerAppShell>
      <main className="space-y-8 animate-fade-in">
        {error && (
          <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-lg flex items-center gap-2" role="alert">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push('/organizer/payouts')}
              className="mb-4 text-neutral-600 hover:text-neutral-900"
            >
              <ArrowLeft className="w-[1rem] h-[1rem] mr-2" />
              Voltar para Repasses
            </Button>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-display font-bold text-neutral-900">
                Detalhes do Repasse
              </h1>
              <Badge variant={statusInfo.variant}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-neutral-600 mt-2">
              {payout.event?.title || 'Todos os eventos'} • {formatDate(payout.createdAt)}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              loading={generatingPDF}
              aria-label="Baixar comprovante em PDF"
            >
              <Download className="w-[1rem] h-[1rem] mr-2" />
              PDF
            </Button>
            {payout.status !== 'PAID' && payout.status !== 'CANCELLED' && (
              <Button
                variant="danger"
                onClick={openCancelModal}
              >
                <Trash2 className="w-[1rem] h-[1rem] mr-2" />
                Cancelar Repasse
              </Button>
            )}
          </div>
        </div>

        {/* Main Amount Card */}
        <Card className="bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200 rounded-2xl shadow-card">
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-primary-700 font-medium mb-2">Valor Líquido a Receber</p>
              <p className="text-5xl font-display font-bold text-primary-900">
                {formatCurrency(payout.finalPayout)}
              </p>
              {payout.scheduledFor && payout.status !== 'PAID' && (
                <p className="text-primary-700 mt-4 flex items-center justify-center gap-2">
                  <Calendar className="w-[1rem] h-[1rem]" />
                  Previsto para {formatDate(payout.scheduledFor)}
                </p>
              )}
              {payout.processedAt && (
                <p className="text-success-700 mt-4 flex items-center justify-center gap-2">
                  <CheckCircle className="w-[1rem] h-[1rem]" />
                  Processado em {formatDate(payout.processedAt)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
                <TrendingUp className="w-[1rem] h-[1rem] text-success-600" />
                Vendas Brutas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-display font-bold text-neutral-900">
                {formatCurrency(payout.totalSales)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
                <TrendingDown className="w-[1rem] h-[1rem] text-error-600" />
                Taxas Totais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-display font-bold text-error-600">
                -{formatCurrency(payout.totalFees)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
                <DollarSign className="w-[1rem] h-[1rem] text-primary-600" />
                Valor Líquido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-display font-bold text-neutral-900">
                {formatCurrency(payout.netAmount)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
                <FileText className="w-[1rem] h-[1rem] text-info-600" />
                Taxa de Transferência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-display font-bold text-neutral-900">
                {payout.bankTransferFee ? `-${formatCurrency(payout.bankTransferFee)}` : 'Isento'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Breakdown */}
          <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader>
              <CardTitle className="font-display">Composição do Valor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-neutral-200">
                <span className="text-neutral-600">Vendas Brutas</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(payout.totalSales)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-neutral-200">
                <span className="text-neutral-600">Taxas de Serviço</span>
                <span className="font-semibold text-error-600">
                  -{formatCurrency(payout.totalFees)}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-neutral-200">
                <span className="text-neutral-600">Subtotal (Vendas - Taxas)</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(payout.netAmount)}
                </span>
              </div>

              {payout.anticipationAmount && (
                <>
                  <div className="flex justify-between items-center py-3 border-b border-neutral-200">
                    <span className="text-neutral-600">Antecipação Solicitada</span>
                    <span className="font-semibold text-info-600">
                      {formatCurrency(payout.anticipationAmount)}
                    </span>
                  </div>
                  {payout.anticipationFee && (
                    <div className="flex justify-between items-center py-3 border-b border-neutral-200">
                      <span className="text-neutral-600">Taxa de Antecipação</span>
                      <span className="font-semibold text-error-600">
                        -{formatCurrency(payout.anticipationFee)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {payout.bankTransferFee && (
                <div className="flex justify-between items-center py-3 border-b border-neutral-200">
                  <span className="text-neutral-600">Taxa de Transferência Bancária</span>
                  <span className="font-semibold text-error-600">
                    -{formatCurrency(payout.bankTransferFee)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-4 bg-primary-50 px-4 rounded-lg -mx-4">
                <span className="font-semibold text-primary-900">Valor Líquido a Receber</span>
                <span className="text-xl font-bold text-primary-900">
                  {formatCurrency(payout.finalPayout)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account Info */}
          <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Dados Bancários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {payout.bankAccount ? (
                <>
                  <div>
                    <p className="text-sm text-neutral-600 mb-1">Banco</p>
                    <p className="font-semibold text-neutral-900">{payout.bankAccount.bankName}</p>
                  </div>

                  <div>
                    <p className="text-sm text-neutral-600 mb-1">Agência</p>
                    <p className="font-semibold text-neutral-900">{payout.bankAccount.agency}</p>
                  </div>

                  <div>
                    <p className="text-sm text-neutral-600 mb-1">Conta</p>
                    <p className="font-semibold text-neutral-900">
                      {payout.bankAccount.account} ({payout.bankAccount.accountType})
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-neutral-600 mb-1">Titular</p>
                    <p className="font-semibold text-neutral-900">{payout.bankAccount.accountHolder}</p>
                  </div>

                  <div>
                    <p className="text-sm text-neutral-600 mb-1">CPF</p>
                    <p className="font-semibold text-neutral-900">{payout.bankAccount.cpf}</p>
                  </div>

                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm text-neutral-600 mb-1">Padrão</p>
                      <p className="font-semibold text-neutral-900">
                        {payout.bankAccount.isDefault ? 'Sim' : 'Não'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-600 mb-1">Verificada</p>
                      <p className="font-semibold text-neutral-900">
                        {payout.bankAccount.isVerified ? 'Sim' : 'Não'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-neutral-600">Conta padrão do organizador</p>
                  <p className="text-neutral-600 text-sm mt-1">
                    Entre em contato com o suporte para atualizar os dados bancários
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Timeline */}
        <Card className="rounded-2xl shadow-card hover:shadow-card-hover transition-shadow">
          <CardHeader>
            <CardTitle className="font-display">Linha do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-neutral-900">Repasse Solicitado</p>
                  <p className="text-sm text-neutral-600">{formatDate(payout.createdAt)}</p>
                </div>
              </div>

              {payout.scheduledFor && (
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    payout.status === 'PENDING' || payout.status === 'APPROVED'
                      ? 'bg-warning-100'
                      : 'bg-success-100'
                  }`}>
                    <Calendar className={`w-5 h-5 ${
                      payout.status === 'PENDING' || payout.status === 'APPROVED'
                        ? 'text-warning-600'
                        : 'text-success-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900">Previsto Para</p>
                    <p className="text-sm text-neutral-600">{formatDate(payout.scheduledFor)}</p>
                  </div>
                </div>
              )}

              {payout.processedAt && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-success-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900">Pagamento Processado</p>
                    <p className="text-sm text-neutral-600">{formatDate(payout.processedAt)}</p>
                  </div>
                </div>
              )}

              {payout.status === 'CANCELLED' && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-error-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-error-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900">Repasse Cancelado</p>
                    <p className="text-sm text-neutral-600">
                      {statusInfo.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                {formatCurrency(payout.finalPayout)}
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
      </main>
    </OrganizerAppShell>
  )
}
