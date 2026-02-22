'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, Ticket, User, Clock } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { ApiError } from '@/hooks/useApi'
import { cn } from '@/lib/cn'

interface ResaleListing {
  id: string
  resalePrice: number
  originalPrice: number
  status: string
  expiresAt: string
  ticket: {
    id: string
    code: string
    type: string
    seat?: {
      label: string
    }
  }
  event: {
    id: string
    title: string
    startTime: string
    location: string
    imageUrl?: string
  }
  seller: {
    id: string
    name: string
  }
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'SOLD', label: 'Vendido' },
  { value: 'CANCELLED', label: 'Cancelado' },
  { value: 'EXPIRED', label: 'Expirado' },
]

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Mais recentes' },
  { value: 'date-asc', label: 'Mais antigos' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
]

const DEFAULT_IMAGE = '/images/event-placeholder.svg'

export default function ResalePage() {
  const [listings, setListings] = useState<ResaleListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [search, setSearch] = useState('')
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('date-desc')

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        ...(status && { status }),
        ...(eventId && { eventId }),
        ...(minPrice && { minPrice }),
        ...(maxPrice && { maxPrice }),
      })

      const response = await fetch(`/api/resale?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        let sortedListings = data

        // Client-side sorting by date
        if (sortBy === 'date-desc') {
          sortedListings.sort((a: ResaleListing, b: ResaleListing) =>
            new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime()
          )
        } else if (sortBy === 'date-asc') {
          sortedListings.sort((a: ResaleListing, b: ResaleListing) =>
            new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
          )
        } else if (sortBy === 'price-asc') {
          sortedListings.sort((a: ResaleListing, b: ResaleListing) =>
            a.resalePrice - b.resalePrice
          )
        } else if (sortBy === 'price-desc') {
          sortedListings.sort((a: ResaleListing, b: ResaleListing) =>
            b.resalePrice - a.resalePrice
          )
        }

        setListings(sortedListings)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar anúncios de revenda',
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
  }, [status, eventId, minPrice, maxPrice, sortBy])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchListings()
  }

  const clearFilters = () => {
    setSearch('')
    setEventId('')
    setStatus('ACTIVE')
    setMinPrice('')
    setMaxPrice('')
    setSortBy('date-desc')
  }

  const hasActiveFilters = search || eventId || minPrice || maxPrice

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price)
  }

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'ACTIVE':
        return 'success'
      case 'SOLD':
        return 'info'
      case 'CANCELLED':
        return 'warning'
      case 'EXPIRED':
        return 'neutral'
      default:
        return 'neutral'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Ativo'
      case 'SOLD':
        return 'Vendido'
      case 'CANCELLED':
        return 'Cancelado'
      case 'EXPIRED':
        return 'Expirado'
      default:
        return status
    }
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  if (loading && listings.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <Header />
        <main
          className="flex-1 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 w-full"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-neutral-200 rounded-2xl h-96 animate-pulse" />
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
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-neutral-900 mb-2">
            Mercado de Revenda
          </h1>
          <p className="text-neutral-600">
            Compre ingressos de outros usuários com segurança
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8" padding="lg">
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Input
                label="Buscar evento"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome do evento..."
                fullWidth
              />

              <Input
                label="ID do Evento"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="ID do evento"
                fullWidth
              />

              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_OPTIONS}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
        </Card>

        {error && (
          <ErrorState
            title="Erro ao Carregar Anúncios"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchListings()}
          />
        )}

        {/* Listings Grid */}
        {listings.length === 0 ? (
          <EmptyState
            type={hasActiveFilters ? 'no-results' : 'no-listings'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const expired = isExpired(listing.expiresAt)
              const cannotBuy = listing.status !== 'ACTIVE' || expired

              return (
                <article key={listing.id}>
                  <Card
                    hover={!cannotBuy}
                    className={cn(
                      "h-full",
                      cannotBuy && "opacity-60"
                    )}
                  >
                    {/* Event Image */}
                  {listing.event.imageUrl ? (
                    <div className="h-48 bg-neutral-200 relative">
                      <Image
                        src={listing.event.imageUrl}
                        alt={listing.event.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                        role="img"
                        aria-label={`Imagem do evento: ${listing.event.title}`}
                      />
                      <div className="absolute top-4 right-4">
                        <Badge variant={getStatusVariant(listing.status)} size="md">
                          {getStatusLabel(listing.status)}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="h-48 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center relative"
                      role="img"
                      aria-label={`Imagem placeholder do evento: ${listing.event.title}`}
                    >
                      <Ticket className="w-16 h-16 text-primary-400" />
                      <div className="absolute top-4 right-4">
                        <Badge variant={getStatusVariant(listing.status)} size="md">
                          {getStatusLabel(listing.status)}
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Event Title */}
                    <Link
                      href={`/events/${listing.event.id}`}
                      className="block mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-xl"
                    >
                      <h3 className="text-xl font-display font-semibold text-neutral-900 mb-2 line-clamp-1 hover:text-primary-600 transition-colors">
                        {listing.event.title}
                      </h3>
                    </Link>

                    {/* Event Details */}
                    <div className="space-y-4 text-sm text-neutral-600 mb-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {formatDate(listing.event.startTime)}
                        </span>
                      </div>
                      {listing.event.location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{listing.event.location}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Ticket className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {listing.ticket.type}
                          {listing.ticket.seat && ` - ${listing.ticket.seat.label}`}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{listing.seller.name}</span>
                      </div>
                      {listing.status === 'ACTIVE' && !expired && (
                        <div className="flex items-start gap-2">
                          <Clock className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">
                            Expira em {formatDate(listing.expiresAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price Section */}
                    <div className="border-t border-neutral-200 pt-4 mt-4">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-2xl font-display font-bold text-success-600">
                          {formatPrice(listing.resalePrice)}
                        </span>
                        <span className="text-sm text-neutral-600 line-through">
                          {formatPrice(listing.originalPrice)}
                        </span>
                      </div>

                      {listing.resalePrice < listing.originalPrice && (
                        <div className="text-sm text-success-600 mb-4">
                          Economize {formatPrice(listing.originalPrice - listing.resalePrice)}
                        </div>
                      )}

                      {cannotBuy ? (
                        <Button
                          variant="outline"
                          fullWidth
                          disabled
                        >
                          {expired ? 'Expirado' : 'Indisponível'}
                        </Button>
                      ) : (
                        <Link href={`/resale/${listing.id}`}>
                          <Button
                            variant="primary"
                            fullWidth
                            aria-label={`Comprar ingresso para ${listing.event.title} por ${formatPrice(listing.resalePrice)}`}
                          >
                            Comprar Ingresso
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
                </article>
              )
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
