'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Input, Select } from '@/components/ui/input'
import type { ApiError } from '@/hooks/useApi'
import type { EventsResponse } from '@/lib/api/events'
import { formatCurrency as formatPrice } from '@/lib/utils/format'

interface EventsClientProps {
  initialData?: EventsResponse | null
}

const STATE_OPTIONS = [
  { value: '', label: 'Todos os estados' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'BA', label: 'Bahia' },
  { value: 'PR', label: 'Paraná' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'PE', label: 'Pernambuco' },
]

const SORT_OPTIONS = [
  { value: 'date-asc', label: 'Data: Mais recente' },
  { value: 'date-desc', label: 'Data: Mais antiga' },
  { value: 'price-asc', label: 'Preço: Menor para maior' },
  { value: 'price-desc', label: 'Preço: Maior para menor' },
  { value: 'title-asc', label: 'Nome: A-Z' },
  { value: 'title-desc', label: 'Nome: Z-A' },
]

const DEFAULT_IMAGE = '/images/event-placeholder.svg'

export function EventsClient({ initialData }: EventsClientProps = {}) {
  const [events, setEvents] = useState(initialData?.events || [])
  const [pagination, setPagination] = useState(
    initialData?.pagination || {
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 0,
    }
  )
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<ApiError | null>(null)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('date-asc')
  const [showFilters, setShowFilters] = useState(true)

  const fetchEvents = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      const [sortField, sortOrder] = sortBy.split('-')

      const params = new URLSearchParams({
        published: 'true',
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: sortField,
        sortOrder: sortOrder,
        ...(search ? { search } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
        ...(minPrice ? { minPrice } : {}),
        ...(maxPrice ? { maxPrice } : {}),
      })

      const response = await fetch(`/api/events?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setEvents(data.events)
        setPagination(data.pagination)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar eventos',
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
  }, [search, city, state, minPrice, maxPrice, sortBy, pagination.pageSize])

  const handlePageChange = (page: number) => {
    fetchEvents(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchEvents(1)
  }

  const clearFilters = () => {
    setSearch('')
    setCity('')
    setState('')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('date-asc')
  }

  const hasActiveFilters = search || city || state || minPrice || maxPrice

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getLowestPrice = (lots: Array<{ price: number }>) => {
    if (lots.length === 0) return null
    return Math.min(...lots.map(l => l.price))
  }

  if (loading && events.length === 0) {
    return (
      <main className="flex-1 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-neutral-200 rounded-lg h-80 animate-pulse" />
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 w-full">
      <h1 className="text-4xl font-bold text-neutral-900 mb-8">
        Descubra Eventos
      </h1>

      {/* Filters */}
      <Card className="mb-8" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900">Filtros</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 text-sm font-medium text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1"
          >
            {showFilters ? (
              <>
                Ocultar <ChevronUp className="w-[1rem] h-[1rem]" />
              </>
            ) : (
              <>
                Mostrar <ChevronDown className="w-[1rem] h-[1rem]" />
              </>
            )}
          </button>
        </div>

        {showFilters && (
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <Input
                label="Buscar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome do evento, cidade..."
                fullWidth
              />

              <Input
                label="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: São Paulo"
                fullWidth
              />

              <Select
                label="Estado"
                value={state}
                onChange={(e) => setState(e.target.value)}
                options={STATE_OPTIONS}
                fullWidth
              />

              <Input
                type="number"
                label="Preço Mínimo"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="R$ 0,00"
                fullWidth
              />

              <Input
                type="number"
                label="Preço Máximo"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="R$ 999,00"
                fullWidth
              />

              <Select
                label="Ordenar por"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={SORT_OPTIONS}
                fullWidth
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="primary">
                Buscar
              </Button>

              {hasActiveFilters && (
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          </form>
        )}
      </Card>

      {error && (
        <ErrorState
          title="Erro ao Carregar Eventos"
          message={getErrorMessageFromError(error)}
          variant={getErrorVariantFromStatus(error.status)}
          onRetry={() => fetchEvents(1)}
        />
      )}

      {/* Events Grid */}
      {events.length === 0 ? (
        <EmptyState
          type={hasActiveFilters ? 'no-results' : 'no-events'}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg"
              >
                <Card hover className="h-full">
                  {event.imageUrl ? (
                    <div className="h-48 bg-neutral-200 relative">
                      <Image
                        src={event.imageUrl}
                        alt={event.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-primary-400" />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2 line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-neutral-600 mb-4 line-clamp-2 text-sm">
                      {event.description}
                    </p>

                    <div className="space-y-2 text-sm text-neutral-600">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{formatDate(event.startTime)}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">
                            {event.city && event.state
                              ? `${event.city}, ${event.state}`
                              : event.location}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {getLowestPrice(event.lots) && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 px-6 pb-6">
                      <span className="text-lg font-bold text-success-600">
                        A partir de {formatPrice(getLowestPrice(event.lots)!)}
                      </span>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
                pageSize={pagination.pageSize}
                totalItems={pagination.total}
                showTotalItems
                showPageSizeSelector={false}
              />
            </div>
          )}
        </>
      )}
    </main>
  )
}
