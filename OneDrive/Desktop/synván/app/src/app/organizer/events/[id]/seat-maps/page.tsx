'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import SeatMapEditor from '@/components/seat-map-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SkeletonCard } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface SeatMap {
  id: string
  name: string
  rows: number
  columns: number
  sectors: Array<{
    id: string
    name: string
    color: string
    price: number
  }>
  _count: {
    seats: number
  }
}

interface Session {
  id: string
  name: string
  startTime: string
  endTime: string
}

export default function SeatMapsPage() {
  const params = useParams()
  const router = useRouter()
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const [eventResponse, sessionsResponse] = await Promise.all([
        fetch(`/api/events/${params.id}`),
        fetch(`/api/events/${params.id}/sessions`)
      ])

      const eventData = await eventResponse.json()

      if (eventResponse.ok) {
        setSeatMaps(eventData.event.seatMaps || [])
      } else {
        setError(eventData.error || 'Erro ao carregar mapas de assento')
      }

      // Sessions may not exist for all events, handle gracefully
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json()
        setSessions(sessionsData.sessions || [])
      } else {
        // If sessions endpoint fails, just set empty array
        setSessions([])
      }
    } catch (err) {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDeleteSeatMap = async (seatMapId: string) => {
    if (!confirm('Tem certeza que deseja deletar este mapa de assento?')) {
      return
    }

    try {
      const response = await fetch(`/api/events/${params.id}/seat-map/${seatMapId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSeatMaps(seatMaps.filter(sm => sm.id !== seatMapId))
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao deletar mapa de assento')
      }
    } catch (err) {
      setError('Erro ao deletar mapa de assento')
    }
  }

  if (loading) {
    return (
      <OrganizerAppShell>
        <main className="space-y-6" aria-live="polite" aria-busy="true">
          {/* Page Header Skeleton */}
          <div className="space-y-2">
            <div className="h-8 bg-neutral-200 rounded animate-pulse w-48" />
            <div className="h-5 bg-neutral-200 rounded animate-pulse w-96" />
          </div>

          {/* Seat Maps Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </OrganizerAppShell>
    )
  }

  return (
    <OrganizerAppShell>
      <main>
        <PageHeader
          title="Mapas de Assento"
          subtitle="Gerencie os mapas de assento do seu evento"
          breadcrumbs={[
            { label: 'Dashboard', href: '/organizer/dashboard' },
            { label: 'Eventos', href: '/organizer/events' },
            { label: 'Mapas de Assento' },
          ]}
          actions={
            !showCreateForm && (
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="gradient"
              >
                Criar Mapa
              </Button>
            )
          }
        />

        {/* Mobile Warning */}
        {isMobile && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-6">
            <p className="font-medium">⚠️ Aviso de mobile</p>
            <p className="text-sm mt-1">
              A edição de mapas de assento funciona melhor em desktop. Recomendamos usar um computador para criar ou editar mapas.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-xl mb-6" role="alert">
            {error}
          </div>
        )}

        {showCreateForm ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-neutral-900">
                Criar Novo Mapa de Assento
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Fechar
              </Button>
            </div>
            <SeatMapEditor eventId={params.id as string} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow border border-neutral-200">
            {seatMaps.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-neutral-600 mb-4">
                  Nenhum mapa de assento criado
                </p>
                <Button onClick={() => setShowCreateForm(true)} variant="gradient">
                  Criar Primeiro Mapa
                </Button>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-neutral-200">
                  <h2 className="text-lg font-display font-bold text-neutral-900">
                    Mapas de Assento ({seatMaps.length})
                  </h2>
                </div>
                <div className="divide-y divide-neutral-200">
                  {seatMaps.map(seatMap => (
                    <div key={seatMap.id} className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-display font-bold text-neutral-900 mb-2">
                            {seatMap.name}
                          </h3>
                          <dl className="space-y-1 text-sm text-neutral-600">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <dt className="font-medium text-neutral-700">Dimensões:</dt>
                                <dd>{seatMap.rows} fileiras × {seatMap.columns} colunas</dd>
                              </div>
                              <div>
                                <dt className="font-medium text-neutral-700">Total de assentos:</dt>
                                <dd>{seatMap._count.seats}</dd>
                              </div>
                            </div>
                            {seatMap.sectors.length > 0 && (
                              <div>
                                <dt className="font-medium text-neutral-700">Setores:</dt>
                                <dd>{seatMap.sectors.map(s => s.name).join(', ')}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/organizer/events/${params.id}/seat-maps/${seatMap.id}`)}
                            aria-label={`Editar mapa ${seatMap.name}`}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSeatMap(seatMap.id)}
                            className="text-error-600 border-error-200 hover:bg-error-50"
                            aria-label={`Deletar mapa ${seatMap.name}`}
                          >
                            Deletar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </OrganizerAppShell>
  )
}
