'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Input, Select } from '@/components/ui/input'
import { EventCard } from '@/components/ui/event-card'
import { SkeletonCard } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import type { ApiError } from '@/hooks/useApi'

interface Event {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string | null
  location: string | null
  city: string | null
  state: string | null
  imageUrl: string | null
  organizer: {
    id: string
    name: string
    email: string
  }
  lots: Array<{
    id: string
    name: string
    price: number
    availableQuantity: number
  }>
}

interface EventsResponse {
  events: Event[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas as categorias' },
  { value: 'show', label: 'Shows' },
  { value: 'musica', label: 'Música' },
  { value: 'teatro', label: 'Teatro' },
  { value: 'comedia', label: 'Comédia' },
  { value: 'esporte', label: 'Esportes' },
  { value: 'futebol', label: 'Futebol' },
  { value: 'workshop', label: 'Workshops' },
  { value: 'curso', label: 'Cursos' },
  { value: 'palestra', label: 'Palestras' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'gastronomia', label: 'Gastronomia' },
  { value: 'arte', label: 'Arte' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'festival', label: 'Festivais' },
  { value: 'infantil', label: 'Infantil' },
  { value: 'negocios', label: 'Negócios' },
]

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

const DATE_RANGE_OPTIONS = [
  { value: '', label: 'Todas as datas' },
  { value: 'today', label: 'Hoje' },
  { value: 'this-week', label: 'Esta semana' },
  { value: 'this-month', label: 'Este mês' },
  { value: 'custom', label: 'Personalizado' },
]

const DEFAULT_IMAGE = '/images/event-placeholder.svg'

// Helper functions for date calculations
const getDateRange = (range: string) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case 'today':
      return {
        startDate: today.toISOString(),
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
      }
    case 'this-week': {
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - dayOfWeek)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      return {
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString()
      }
    }
    case 'this-month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      return {
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString()
      }
    }
    default:
      return null
  }
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('date-asc')
  const [dateRange, setDateRange] = useState('')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  const fetchEvents = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      const [sortField, sortOrder] = sortBy.split('-')

      // Calculate date range based on selection
      let startDate: string | undefined
      let endDate: string | undefined

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        startDate = customStartDate
        endDate = customEndDate
      } else if (dateRange && dateRange !== 'custom') {
        const range = getDateRange(dateRange)
        if (range) {
          startDate = range.startDate
          endDate = range.endDate
        }
      }

      const params = new URLSearchParams({
        published: 'true',
        page: page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: sortField,
        sortOrder: sortOrder,
        ...(category ? { category } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
        ...(minPrice ? { minPrice } : {}),
        ...(maxPrice ? { maxPrice } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      })

      const response = await fetch(`/api/events?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        // Client-side filter: search by title, description, city, AND organizer name
        let filteredEvents = data.events
        if (search) {
          const searchLower = search.toLowerCase()
          filteredEvents = data.events.filter((event: Event) =>
            event.title.toLowerCase().includes(searchLower) ||
            event.description.toLowerCase().includes(searchLower) ||
            (event.city && event.city.toLowerCase().includes(searchLower)) ||
            (event.organizer && event.organizer.name.toLowerCase().includes(searchLower))
          )
        }

        setEvents(filteredEvents)
        setPagination({
          ...data.pagination,
          total: filteredEvents.length,
          totalPages: Math.ceil(filteredEvents.length / pagination.pageSize)
        })
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
  }, [search, category, city, state, minPrice, maxPrice, sortBy, dateRange, customStartDate, customEndDate, pagination.pageSize])

  useEffect(() => {
    fetchEvents(1)
  }, [fetchEvents])

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
    setCategory('')
    setCity('')
    setState('')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('date-asc')
    setDateRange('')
    setCustomStartDate('')
    setCustomEndDate('')
  }

  const hasActiveFilters = search || category || city || state || minPrice || maxPrice || dateRange

  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 w-full">
        <h1 className={cn("text-4xl md:text-5xl font-display font-bold text-neutral-900 mb-4")}>
          Descubra <span className="text-gradient">Eventos</span>
        </h1>
        <p className="text-neutral-600 mb-8">Encontre as melhores experiências próximas de você</p>

        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="relative max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-16 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar eventos, cidades..."
                className={cn(
                  "w-full pl-48 pr-4 py-4 rounded-xl border-2 border-neutral-200",
                  "bg-white text-neutral-900 placeholder-neutral-400",
                  "focus:outline-none focus:ring-2 focus:ring-coral-500 focus:border-transparent",
                  "transition-all duration-200"
                )}
              />
            </div>
          </form>
        </div>

        {/* Filters */}
        <Card className="mb-8 shadow-card" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn("text-lg font-display font-semibold text-neutral-900")}>
              Filtros Avançados
            </h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "md:hidden flex items-center gap-2 text-sm font-medium text-neutral-600",
                "focus:outline-none focus:ring-2 focus:ring-coral-500 focus:ring-offset-2",
                "rounded-xl px-3 py-2 hover:bg-neutral-50 transition-colors"
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <Select
                  label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={CATEGORY_OPTIONS}
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

                <Select
                  label="Período"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  options={DATE_RANGE_OPTIONS}
                  fullWidth
                />

                {dateRange === 'custom' && (
                  <>
                    <Input
                      type="date"
                      label="Data Inicial"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      fullWidth
                    />

                    <Input
                      type="date"
                      label="Data Final"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      fullWidth
                    />
                  </>
                )}

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

              <div className="flex flex-wrap gap-4">
                <Button type="submit" variant="gradient">
                  Aplicar Filtros
                </Button>

                {hasActiveFilters && (
                  <Button type="button" variant="soft" onClick={clearFilters}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  href={`/events/${event.id}`}
                  imageSize="sm"
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white rounded-2xl shadow-card p-6">
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

      <Footer />
    </div>
  )
}
