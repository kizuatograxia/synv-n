'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, Ticket, Trash2, ExternalLink, XCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/hooks/useToast'
import type { ApiError } from '@/hooks/useApi'
import { cn } from '@/lib/cn'

interface ResaleListing {
  id: string
  resalePrice: number
  originalPrice: number
  status: string
  expiresAt: string
  soldAt?: string
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
}

const DEFAULT_IMAGE = '/images/event-placeholder.svg'

export default function MyResaleListingsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const toast = useToast()
  const [listings, setListings] = useState<ResaleListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [listingToCancel, setListingToCancel] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const fetchListings = useCallback(async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/resale/my-listings')
      const data = await response.json()

      if (response.ok) {
        setListings(data)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar seus anúncios',
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
  }, [session?.user?.id])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchListings()
    } else if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router, fetchListings])

  const handleCancelClick = (listingId: string) => {
    setListingToCancel(listingId)
    setShowCancelModal(true)
  }

  const handleCancelConfirm = async () => {
    if (!listingToCancel) return

    setCancelling(true)
    setError(null)

    try {
      const response = await fetch(`/api/resale/${listingToCancel}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Anúncio cancelado com sucesso!')
        setShowCancelModal(false)
        setListingToCancel(null)
        fetchListings()
      } else {
        const errorMsg = data.error || 'Erro ao cancelar anúncio'
        const apiError: ApiError = {
          message: errorMsg,
          status: response.status,
        }
        setError(apiError)
        toast.error(errorMsg)
      }
    } catch (err) {
      const errorMsg = 'Erro ao cancelar anúncio'
      const apiError: ApiError = {
        message: errorMsg,
        status: undefined,
      }
      setError(apiError)
      toast.error(errorMsg)
    } finally {
      setCancelling(false)
    }
  }

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

  const canCancel = (listing: ResaleListing) => {
    return listing.status === 'ACTIVE' && !isExpired(listing.expiresAt)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 w-full">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            aria-live="polite"
            aria-busy="true"
            aria-label="Carregando seus anúncios de revenda"
          >
            {[1, 2, 3].map((i) => (
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-display font-bold text-neutral-900 mb-2">
                Meus Anúncios de Revenda
              </h1>
              <p className="text-neutral-600">
                Gerencie os ingressos que você está vendendo no mercado de revenda
              </p>
            </div>
            <Link href="/orders">
              <Button variant="outline">
                Ver Meus Pedidos
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <ErrorState
            title="Erro ao Carregar Anúncios"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchListings()}
          />
        )}

        {listings.length === 0 ? (
          <EmptyState
            type="no-listings"
            action={{
              label: 'Ver Meus Pedidos',
              onClick: () => router.push('/orders')
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => {
              const expired = isExpired(listing.expiresAt)
              const cannotCancel = !canCancel(listing)

              return (
                <article
                  key={listing.id}
                  className={cn(
                    "bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-shadow h-full",
                    (listing.status === 'CANCELLED' || listing.status === 'EXPIRED') && 'opacity-60'
                  )}
                >
                  {/* Event Image */}
                  {listing.event.imageUrl ? (
                    <div className="h-48 bg-neutral-200 relative">
                      <Image
                        src={listing.event.imageUrl}
                        alt={`Imagem do evento ${listing.event.title}`}
                        fill
                        className="object-cover"
                        role="img"
                        aria-label={`Foto do evento: ${listing.event.title}`}
                      />
                      <div className="absolute top-4 right-4">
                        <Badge variant={getStatusVariant(listing.status)} size="md">
                          {getStatusLabel(listing.status)}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center relative">
                      <Ticket className="w-16 h-16 text-primary-400" aria-hidden="true" />
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
                        <ExternalLink className="w-[1rem] h-[1rem] mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1 text-xs">
                          Código: {listing.ticket.code}
                        </span>
                      </div>
                      {listing.status === 'ACTIVE' && !expired && (
                        <div className="text-xs text-warning-600">
                          Expira em {formatDate(listing.expiresAt)}
                        </div>
                      )}
                      {listing.status === 'SOLD' && listing.soldAt && (
                        <div className="text-xs text-info-600">
                          Vendido em {formatDate(listing.soldAt)}
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
                        <div className="text-sm text-error-600 mb-4">
                          {listing.resalePrice < listing.originalPrice * 0.8
                            ? '⚠️ Preço abaixo do valor mínimo recomendado'
                            : `Desconto de ${Math.round((1 - listing.resalePrice / listing.originalPrice) * 100)}%`
                          }
                        </div>
                      )}

                      <div className="flex gap-2">
                        {cannotCancel ? (
                          <Button
                            variant="outline"
                            fullWidth
                            disabled
                          >
                            {expired ? 'Expirado' : listing.status === 'SOLD' ? 'Vendido' : 'Indisponível'}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            fullWidth
                            onClick={() => handleCancelClick(listing.id)}
                          >
                            <XCircle className="w-[1rem] h-[1rem] mr-2" />
                            Cancelar Anúncio
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>

      <Footer />

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false)
            setListingToCancel(null)
          }}
          title="Cancelar Anúncio"
        >
          <div className="space-y-4">
            <p className="text-neutral-700">
              Tem certeza que deseja cancelar este anúncio de revenda?
            </p>
            <p className="text-sm text-neutral-600">
              O ingresso voltará a estar disponível nos seus pedidos, mas você precisará criar um novo anúncio se quiser vendê-lo novamente.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={() => {
                  setShowCancelModal(false)
                  setListingToCancel(null)
                }}
                variant="outline"
                disabled={cancelling}
              >
                Manter Anúncio
              </Button>
              <Button
                type="button"
                onClick={handleCancelConfirm}
                variant="danger"
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Cancelar Anúncio'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
