'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonCard, SkeletonStat } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/cn'
import { Calendar, MapPin, Users, Ticket, Plus, Eye, Settings, BarChart3, Edit, Layers } from 'lucide-react'
import Image from 'next/image'

interface Event {
  id: string
  title: string
  description: string
  slug: string
  startTime: string
  endTime: string | null
  location: string | null
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

interface EventsStats {
  totalEvents: number
  publishedEvents: number
  draftEvents: number
  totalTickets: number
  totalRevenue?: number
}

const statusConfig = {
  published: { label: 'Publicado', variant: 'success' as const },
  draft: { label: 'Rascunho', variant: 'neutral' as const },
}

export default function OrganizerEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [stats, setStats] = useState<EventsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/events?organizerId=me&sortBy=date&sortOrder=desc&pageSize=100')
      const data = await response.json()

      if (response.ok) {
        setEvents(data.events || [])

        // Calculate stats from events
        const calculatedStats: EventsStats = {
          totalEvents: data.events?.length || 0,
          publishedEvents: 0,
          draftEvents: 0,
          totalTickets: 0,
        }

        for (const event of data.events || []) {
          if (event.isPublished) {
            calculatedStats.publishedEvents++
          } else {
            calculatedStats.draftEvents++
          }

          // Sum up total quantities from lots
          for (const lot of event.lots || []) {
            calculatedStats.totalTickets += lot.totalQuantity
          }
        }

        setStats(calculatedStats)
      } else {
        setError(data.error || 'Erro ao carregar eventos')
      }
    } catch (err) {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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

  const getMinPrice = (event: Event) => {
    if (!event.lots?.length) return 0
    return Math.min(...event.lots.map(lot => lot.price))
  }

  const getMaxPrice = (event: Event) => {
    if (!event.lots?.length) return 0
    return Math.max(...event.lots.map(lot => lot.price))
  }

  const getPriceDisplay = (event: Event) => {
    const min = getMinPrice(event)
    const max = getMaxPrice(event)

    if (min === 0 && max === 0) {
      return 'Gratuito'
    } else if (min === max) {
      return formatCurrency(min)
    } else {
      return `${formatCurrency(min)} - ${formatCurrency(max)}`
    }
  }

  const isEventPast = (event: Event) => {
    return new Date(event.startTime) < new Date()
  }

  if (loading) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Meus Eventos"
          subtitle="Gerencie seus eventos e acompanhe o desempenho"
        />

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
        </div>

        {/* Events Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </OrganizerAppShell>
    )
  }

  if (error) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Meus Eventos"
          subtitle="Gerencie seus eventos e acompanhe o desempenho"
        />
        <ErrorState
          title="Erro ao Carregar Eventos"
          message={error}
          variant="server"
          onRetry={fetchEvents}
        />
      </OrganizerAppShell>
    )
  }

  return (
    <OrganizerAppShell>
      <PageHeader
        title="Meus Eventos"
        subtitle="Gerencie seus eventos e acompanhe o desempenho"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/organizer/events/new')}
          >
            <Plus className="w-[1rem] h-[1rem] mr-2" />
            Criar Evento
          </Button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-2xl p-6 border border-neutral-200/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Total de Eventos</p>
                <p className="text-2xl font-bold font-display text-neutral-900">{stats.totalEvents}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-neutral-200/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
                <Ticket className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Publicados</p>
                <p className="text-2xl font-bold font-display text-neutral-900">{stats.publishedEvents}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-neutral-200/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center">
                <Ticket className="w-6 h-6 text-neutral-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Rascunhos</p>
                <p className="text-2xl font-bold font-display text-neutral-900">{stats.draftEvents}</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-neutral-200/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-secondary-600" />
              </div>
              <div>
                <p className="text-sm text-neutral-600">Total de Ingressos</p>
                <p className="text-2xl font-bold font-display text-neutral-900">{stats.totalTickets}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events Grid */}
      {events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="Nenhum evento criado"
          description="Comece criando seu primeiro evento para vender ingressos."
          action={{
            label: 'Criar Primeiro Evento',
            onClick: () => router.push('/organizer/events/new'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => router.push(`/events/${event.id}`)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') router.push(`/events/${event.id}`)
              }}
              role="button"
              tabIndex={0}
              className="group hover:shadow-card-hover transition-all duration-300 cursor-pointer"
            >
              <Card className="h-full">
              {/* Event Image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-neutral-100">
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
                    <Calendar className="w-12 h-12 text-white/80" />
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  <Badge variant={event.isPublished ? 'success' : 'neutral'}>
                    {event.isPublished ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>

                {/* Past Event Badge */}
                {isEventPast(event) && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="neutral">Encerrado</Badge>
                  </div>
                )}
              </div>

              {/* Event Content */}
              <div className="p-4">
                <h3 className="font-display font-semibold text-lg text-neutral-900 mb-2 line-clamp-2">
                  {event.title}
                </h3>

                {/* Date and Time */}
                <div className="flex items-center gap-4 text-sm text-neutral-600 mb-4">
                  <Calendar className="w-[1rem] h-[1rem] flex-shrink-0" />
                  <span>
                    {formatDate(event.startTime)} às {formatTime(event.startTime)}
                  </span>
                </div>

                {/* Location */}
                {event.city && (
                  <div className="flex items-center gap-4 text-sm text-neutral-600 mb-8">
                    <MapPin className="w-[1rem] h-[1rem] flex-shrink-0" />
                    <span className="line-clamp-1">
                      {event.city}
                      {event.state && `, ${event.state}`}
                    </span>
                  </div>
                )}

                {/* Price */}
                <div className="mb-4">
                  <span className="text-lg font-bold text-primary-600">
                    {getPriceDisplay(event)}
                  </span>
                </div>

                {/* Stats */}
                {event.lots && event.lots.length > 0 && (
                  <div className="flex items-center justify-between text-sm text-neutral-600 pt-4 border-t border-neutral-200">
                    <div className="flex items-center gap-4">
                      <Users className="w-[1rem] h-[1rem]" />
                      <span>
                        {getTotalSold(event)} vendidos
                      </span>
                    </div>
                    <div>
                      <span>
                        {getTotalAvailable(event)} disponíveis
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-4 grid grid-cols-4 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/events/${event.id}`)
                  }}
                >
                  <Eye className="w-[1rem] h-[1rem] mr-4" />
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/organizer/events/${event.id}/manage`)
                  }}
                >
                  <Edit className="w-[1rem] h-[1rem] mr-4" />
                  Gerenciar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/organizer/events/${event.id}/lots`)
                  }}
                >
                  <Layers className="w-[1rem] h-[1rem] mr-4" />
                  Lotes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/organizer/events/${event.id}/checkin`)
                  }}
                >
                  <Ticket className="w-[1rem] h-[1rem] mr-4" />
                  Check-in
                </Button>
              </div>
            </Card>
            </div>
          ))}
        </div>
      )}
    </OrganizerAppShell>
  )
}
