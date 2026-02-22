'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useToast } from '@/hooks/useToast'
import type { ApiError } from '@/hooks/useApi'
import { getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Calendar, MapPin, Users, Ticket, ArrowLeft, Settings, Eye, CheckCircle, XCircle, Clock, Copy, Layers, TrendingUp, ShoppingCart } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/cn'

interface RealTimeStats {
  activeTicketsSold: number
  todayRevenue: number
  pendingOrders: number
  approvedOrders: number
}

interface Event {
  id: string
  title: string
  description: string
  slug: string
  startTime: string
  endTime: string | null
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  imageUrl: string | null
  isPublished: boolean
  lots: Array<{
    id: string
    name: string
    price: number
    availableQuantity: number
    totalQuantity: number
  }>
  _count?: {
    orders: number
    tickets: number
  }
}

type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled'

const statusConfig = {
  draft: {
    label: 'Rascunho',
    variant: 'neutral' as const,
    description: 'Evento não visível publicamente',
    icon: Clock,
    nextAction: 'publish'
  },
  published: {
    label: 'Publicado',
    variant: 'success' as const,
    description: 'Evento visível e disponível para venda',
    icon: CheckCircle,
    nextAction: 'unpublish'
  },
  completed: {
    label: 'Concluído',
    variant: 'info' as const,
    description: 'Evento já ocorreu',
    icon: CheckCircle,
    nextAction: null
  },
  cancelled: {
    label: 'Cancelado',
    variant: 'error' as const,
    description: 'Evento foi cancelado',
    icon: XCircle,
    nextAction: null
  }
}

export default function EventManagePage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [updating, setUpdating] = useState(false)
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Modal states
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false)
  const [cloneModalOpen, setCloneModalOpen] = useState(false)

  const fetchEvent = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/events/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setEvent(data.event)
        setError(null)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar evento',
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
  }, [params.id])

  useEffect(() => {
    fetchEvent()
  }, [params.id, fetchEvent])

  // Fetch real-time analytics
  useEffect(() => {
    const fetchRealTimeStats = async () => {
      if (!event) return

      try {
        setLoadingStats(true)
        const params = new URLSearchParams({
          eventId: event.id,
          days: '30'
        })

        const response = await fetch(`/api/analytics?${params}`)
        if (response.ok) {
          const data = await response.json()
          setRealTimeStats(data.realTimeStats)
        }
      } catch (err) {
        // Silently fail - stats are supplementary
        console.error('Error fetching real-time stats:', err)
      } finally {
        setLoadingStats(false)
      }
    }

    fetchRealTimeStats()
  }, [event])

  const getEventStatus = (event: Event): EventStatus => {
    const now = new Date()
    const eventEnd = event.endTime ? new Date(event.endTime) : new Date(event.startTime)

    if (eventEnd < now) {
      return 'completed'
    }

    return event.isPublished ? 'published' : 'draft'
  }

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
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTotalSold = (event: Event) => {
    return event.lots?.reduce((sum, lot) => sum + (lot.totalQuantity - lot.availableQuantity), 0) || 0
  }

  const getTotalAvailable = (event: Event) => {
    return event.lots?.reduce((sum, lot) => sum + lot.availableQuantity, 0) || 0
  }

  const getTotalRevenue = (event: Event) => {
    return event.lots?.reduce((sum, lot) => {
      const sold = lot.totalQuantity - lot.availableQuantity
      return sum + (sold * lot.price)
    }, 0) || 0
  }

  const handlePublish = async () => {
    if (!event) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: true })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Evento publicado com sucesso!')
        setPublishModalOpen(false)
        await fetchEvent()
      } else {
        toast.error(data.error || 'Erro ao publicar evento')
      }
    } catch (error) {
      toast.error('Erro ao publicar evento. Tente novamente.')
    } finally {
      setUpdating(false)
    }
  }

  const handleUnpublish = async () => {
    if (!event) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: false })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Evento movido para rascunho!')
        setUnpublishModalOpen(false)
        await fetchEvent()
      } else {
        toast.error(data.error || 'Erro ao atualizar evento')
      }
    } catch (error) {
      toast.error('Erro ao atualizar evento. Tente novamente.')
    } finally {
      setUpdating(false)
    }
  }

  const handleClone = async () => {
    if (!event) return

    setUpdating(true)
    try {
      // Generate a new slug based on the original title
      const generateSlug = (title: string) => {
        return title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      }

      const cloneSlug = (slug: string) => {
        const match = slug.match(/^(.*?)(\d+)$/)
        if (match) {
          const base = match[1]
          const num = parseInt(match[2], 10)
          return `${base}${num + 1}`
        }
        return `${slug}-2`
      }

      // Create cloned event data
      const clonedEventData = {
        title: `${event.title} (Cópia)`,
        slug: cloneSlug(event.slug),
        description: event.description,
        location: event.location,
        address: event.address,
        city: event.city,
        state: event.state,
        imageUrl: event.imageUrl,
        // Note: Not copying dates - organizer should set new dates for recurring events
        startTime: new Date().toISOString().slice(0, 16),
        endTime: event.endTime ? new Date().toISOString().slice(0, 16) : null,
        isPublished: false // Always create clones as drafts
      }

      // Create the cloned event
      const eventResponse = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clonedEventData)
      })

      const eventData = await eventResponse.json()

      if (!eventResponse.ok) {
        toast.error(eventData.error || 'Erro ao duplicar evento')
        setUpdating(false)
        return
      }

      const newEventId = eventData.event.id

      // Clone lots if any exist
      if (event.lots && event.lots.length > 0) {
        const lotsPromises = event.lots.map(lot =>
          fetch(`/api/events/${newEventId}/lots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: lot.name,
              price: lot.price,
              totalQuantity: lot.totalQuantity,
              availableQuantity: lot.totalQuantity, // Reset to full quantity
              startDate: new Date().toISOString(),
              endDate: lot.totalQuantity > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
              isActive: true
            })
          }).then(async (response) => {
            if (!response.ok) {
              const lotData = await response.json()
              throw new Error(lotData.error || `Erro ao criar lote ${lot.name}`)
            }
            return response.json()
          })
        )

        try {
          await Promise.all(lotsPromises)
        } catch (lotError: any) {
          toast.error(lotError.message || 'Erro ao criar lotes')
          setUpdating(false)
          return
        }
      }

      toast.success('Evento duplicado com sucesso!')
      setCloneModalOpen(false)
      router.push(`/organizer/events/${newEventId}/manage`)
    } catch (error) {
      toast.error('Erro ao duplicar evento. Tente novamente.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Gerenciar Evento"
          subtitle="Configure o status e opções do evento"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
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
          title="Gerenciar Evento"
          subtitle="Configure o status e opções do evento"
        />
        <ErrorState
          title="Erro ao Carregar Evento"
          message={getErrorMessageFromError(error)}
          variant={getErrorVariantFromStatus(error.status)}
          onRetry={() => fetchEvent()}
          onGoBack={() => router.push('/organizer/events')}
        />
      </OrganizerAppShell>
    )
  }

  if (!event) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Gerenciar Evento"
          subtitle="Configure o status e opções do evento"
        />
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="Evento não encontrado"
          description="O evento que você está procurando não existe ou você não tem permissão para acessá-lo."
          action={{
            label: 'Voltar para Meus Eventos',
            onClick: () => router.push('/organizer/events'),
          }}
        />
      </OrganizerAppShell>
    )
  }

  const status = getEventStatus(event)
  const statusInfo = statusConfig[status]
  const StatusIcon = statusInfo.icon

  return (
    <OrganizerAppShell>
      <main className="space-y-8">
        <PageHeader
          title="Gerenciar Evento"
          subtitle="Configure o status e opções do evento"
          breadcrumbs={[
            { label: 'Meus Eventos', href: '/organizer/events' },
            { label: event.title, href: `/events/${event.id}` },
            { label: 'Gerenciar' },
          ]}
        />

        {/* Status Overview Card */}
        <Card className="p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Event Image */}
              <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
                    <Calendar className="w-8 h-8 text-white/80" />
                  </div>
                )}
              </div>

              {/* Event Info */}
              <div>
                <h2 className="text-xl font-display font-semibold text-neutral-900 mb-8">
                  {event.title}
                </h2>
                <div className="flex items-center gap-4 text-sm text-neutral-600">
                  <Calendar className="w-[1rem] h-[1rem]" />
                  <span>{formatDate(event.startTime)} às {formatTime(event.startTime)}</span>
                </div>
                {event.city && (
                  <div className="flex items-center gap-4 text-sm text-neutral-600 mt-8">
                    <MapPin className="w-[1rem] h-[1rem]" />
                    <span>{event.city}{event.state && `, ${event.state}`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-4">
              <Badge variant={statusInfo.variant} size="md">
                <StatusIcon className="w-[1rem] h-[1rem] mr-4" />
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Real-Time Sales Summary */}
        <Card className="p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-display font-semibold text-neutral-900">
                  Resumo de Vendas em Tempo Real
                </h3>
                <p className="text-sm text-neutral-600">
                  Estatísticas atualizadas das vendas do evento
                </p>
              </div>
            </div>
            <Badge variant="info" size="sm">
              Últimas 24h
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Tickets Sold */}
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center">
                  <Ticket className="w-[1rem] h-[1rem] text-secondary-600" />
                </div>
                <span className="text-sm text-neutral-600">Vendidos Hoje</span>
              </div>
              {loadingStats ? (
                <div className="h-8 bg-neutral-200 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold font-display text-neutral-900">
                  {realTimeStats?.activeTicketsSold ?? 0}
                </p>
              )}
            </div>

            {/* Today's Revenue */}
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <Users className="w-[1rem] h-[1rem] text-success-600" />
                </div>
                <span className="text-sm text-neutral-600">Receita Hoje</span>
              </div>
              {loadingStats ? (
                <div className="h-8 bg-neutral-200 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold font-display text-success-600">
                  {formatCurrency(realTimeStats?.todayRevenue ?? 0)}
                </p>
              )}
            </div>

            {/* Pending Orders */}
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-[1rem] h-[1rem] text-warning-600" />
                </div>
                <span className="text-sm text-neutral-600">Pendentes</span>
              </div>
              {loadingStats ? (
                <div className="h-8 bg-neutral-200 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold font-display text-warning-600">
                  {realTimeStats?.pendingOrders ?? 0}
                </p>
              )}
            </div>

            {/* Approved Orders */}
            <div className="bg-neutral-50 rounded-xl p-4">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-[1rem] h-[1rem] text-primary-600" />
                </div>
                <span className="text-sm text-neutral-600">Aprovados</span>
              </div>
              {loadingStats ? (
                <div className="h-8 bg-neutral-200 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold font-display text-primary-600">
                  {realTimeStats?.approvedOrders ?? 0}
                </p>
              )}
            </div>
          </div>

          {/* Check-in Link */}
          <div className="mt-8 pt-8 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Acompanhamento de Check-in
                </p>
                <p className="text-sm text-neutral-600">
                  Gerencie check-ins e visualize estatísticas de presença
                </p>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => router.push(`/organizer/events/${event.id}/checkin`)}
              >
                <Ticket className="w-[1rem] h-[1rem] mr-4" />
                Gerenciar Check-in
              </Button>
            </div>
          </div>
        </Card>

        {/* Status Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {status === 'draft' && (
            <Card className="p-8 bg-primary-50 border-primary-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-primary-900 mb-4">
                    Publicar Evento
                  </h3>
                  <p className="text-sm text-primary-700 mb-4">
                    Torne este evento visível publicamente e disponível para venda de ingressos.
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setPublishModalOpen(true)}
                    disabled={updating}
                    loading={updating}
                  >
                    Publicar Agora
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {status === 'published' && (
            <Card className="p-8 bg-warning-50 border-warning-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-warning-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-warning-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-warning-900 mb-4">
                    Mover para Rascunho
                  </h3>
                  <p className="text-sm text-warning-700 mb-4">
                    Torne o evento invisível publicamente. As vendas serão pausadas.
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setUnpublishModalOpen(true)}
                    disabled={updating}
                    loading={updating}
                  >
                    Mover para Rascunho
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {status === 'completed' && (
            <Card className="p-8 bg-success-50 border-success-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-success-900 mb-4">
                    Evento Concluído
                  </h3>
                  <p className="text-sm text-success-700 mb-4">
                    Este evento já ocorreu. O status não pode ser alterado.
                  </p>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => router.push(`/organizer/events/${event.id}/checkin`)}
                  >
                    Ver Check-in
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Stats */}
          <Card className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center">
                <Ticket className="w-6 h-6 text-secondary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Ingressos Vendidos</p>
                <p className="text-2xl font-bold font-display text-neutral-900">
                  {getTotalSold(event)}
                </p>
              </div>
            </div>
            <div className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{getTotalAvailable(event)}</span> disponíveis
            </div>
          </Card>

          <Card className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Receita Total</p>
                <p className="text-2xl font-bold font-display text-success-600">
                  {formatCurrency(getTotalRevenue(event))}
                </p>
              </div>
            </div>
            <div className="text-sm text-neutral-600">
              Vendas de ingressos
            </div>
          </Card>
        </div>

        {/* Status Timeline */}
        <Card className="p-8">
          <h3 className="text-lg font-display font-semibold text-neutral-900 mb-8">
            Fluxo de Status do Evento
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200" />

            {/* Status steps */}
            <div className="space-y-8">
              {/* Draft */}
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 border-2",
                  status === 'draft' ? 'bg-primary-600 border-primary-600' : 'bg-white border-neutral-300'
                )}>
                  <Clock className={cn(
                    "w-[1rem] h-[1rem]",
                    status === 'draft' ? 'text-white' : 'text-neutral-400'
                  )} />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className={cn(
                    "font-medium",
                    status === 'draft' ? 'text-primary-600' : 'text-neutral-600'
                  )}>
                    Rascunho
                  </h4>
                  <p className="text-sm text-neutral-600">
                    Evento criado mas não publicado ainda
                  </p>
                </div>
              </div>

              {/* Published */}
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 border-2",
                  status === 'published' ? 'bg-success-600 border-success-600' : 'bg-white border-neutral-300'
                )}>
                  <CheckCircle className={cn(
                    "w-[1rem] h-[1rem]",
                    status === 'published' ? 'text-white' : 'text-neutral-400'
                  )} />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className={cn(
                    "font-medium",
                    status === 'published' ? 'text-success-600' : 'text-neutral-600'
                  )}>
                    Publicado
                  </h4>
                  <p className="text-sm text-neutral-600">
                    Evento visível publicamente e vendas abertas
                  </p>
                </div>
              </div>

              {/* Completed */}
              <div className="relative flex items-start gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center z-10 border-2",
                  status === 'completed' ? 'bg-info-600 border-info-600' : 'bg-white border-neutral-300'
                )}>
                  <CheckCircle className={cn(
                    "w-[1rem] h-[1rem]",
                    status === 'completed' ? 'text-white' : 'text-neutral-400'
                  )} />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className={cn(
                    "font-medium",
                    status === 'completed' ? 'text-info-600' : 'text-neutral-600'
                  )}>
                    Concluído
                  </h4>
                  <p className="text-sm text-neutral-600">
                    Evento já ocorreu (automático quando a data passa)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Additional Actions */}
        <Card className="p-8">
          <h3 className="text-lg font-display font-semibold text-neutral-900 mb-4">
            Ações Rápidas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/events/${event.id}`)}
            >
              <Eye className="w-[1rem] h-[1rem] mr-4" />
              Ver Página Pública
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/organizer/events/${event.id}/attendees`)}
            >
              <Users className="w-[1rem] h-[1rem] mr-4" />
              Lista de Participantes
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/organizer/events/${event.id}/lots`)}
            >
              <Layers className="w-[1rem] h-[1rem] mr-4" />
              Gerenciar Lotes
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/organizer/events/${event.id}/checkin`)}
            >
              <Ticket className="w-[1rem] h-[1rem] mr-4" />
              Gerenciar Check-in
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => router.push(`/organizer/events/${event.id}/seat-maps`)}
            >
              <Settings className="w-[1rem] h-[1rem] mr-4" />
              Mapa de Assentos
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setCloneModalOpen(true)}
            >
              <Copy className="w-[1rem] h-[1rem] mr-4" />
              Duplicar Evento
            </Button>
          </div>
        </Card>
      </main>

      {/* Publish Confirmation Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publicar Evento"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <p className="text-sm text-primary-800">
              Ao publicar o evento, ele ficará visível publicamente e as vendas de ingressos serão iniciadas.
            </p>
          </div>

          <div className="space-y-4 text-sm text-neutral-700">
            <p><strong>O que acontece ao publicar:</strong></p>
            <ul className="space-y-4 list-disc list-inside">
              <li>O evento aparecerá na listagem pública</li>
              <li>Usuários poderão comprar ingressos</li>
              <li>O evento será searchable na plataforma</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              variant="outline"
              onClick={() => setPublishModalOpen(false)}
              disabled={updating}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={updating}
              loading={updating}
              className="flex-1"
            >
              Confirmar Publicação
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unpublish Confirmation Modal */}
      <Modal
        isOpen={unpublishModalOpen}
        onClose={() => setUnpublishModalOpen(false)}
        title="Mover para Rascunho"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
            <p className="text-sm text-warning-800">
              Ao mover para rascunho, o evento ficará invisível publicamente e as vendas serão pausadas.
            </p>
          </div>

          <div className="space-y-4 text-sm text-neutral-700">
            <p><strong>O que acontece ao mover para rascunho:</strong></p>
            <ul className="space-y-4 list-disc list-inside">
              <li>O evento não aparecerá mais na listagem pública</li>
              <li>As vendas de ingressos serão pausadas</li>
              <li>Ingressos já vendidos permanecem válidos</li>
              <li>Você poderá republicar quando quiser</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              variant="outline"
              onClick={() => setUnpublishModalOpen(false)}
              disabled={updating}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleUnpublish}
              disabled={updating}
              loading={updating}
              className="flex-1"
            >
              Mover para Rascunho
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clone Confirmation Modal */}
      <Modal
        isOpen={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        title="Duplicar Evento"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <p className="text-sm text-primary-800">
              Isso criará uma cópia deste evento como um rascunho. Você poderá editar os dados e publicar quando quiser.
            </p>
          </div>

          <div className="space-y-4 text-sm text-neutral-700">
            <p><strong>O que será copiado:</strong></p>
            <ul className="space-y-4 list-disc list-inside">
              <li>Título, descrição e informações do local</li>
              <li>Imagem do evento</li>
              <li>Lotes de ingressos (com quantidades resetadas)</li>
            </ul>
          </div>

          <div className="space-y-4 text-sm text-neutral-700">
            <p><strong>O que NÃO será copiado:</strong></p>
            <ul className="space-y-4 list-disc list-inside">
              <li>Vendas e pedidos do evento original</li>
              <li>Check-ins realizados</li>
              <li>Data/hora do evento (você deve definir novas datas)</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              variant="outline"
              onClick={() => setCloneModalOpen(false)}
              disabled={updating}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleClone}
              disabled={updating}
              loading={updating}
              className="flex-1"
            >
              Duplicar Evento
            </Button>
          </div>
        </div>
      </Modal>
    </OrganizerAppShell>
  )
}
