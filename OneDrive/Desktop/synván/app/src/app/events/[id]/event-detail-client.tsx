'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { EventCard } from '@/components/ui/event-card'
import { SkeletonCard } from '@/components/ui/skeleton'
import { useApi } from '@/hooks/useApi'
import { Copy, Check, Calendar, MapPin, User, Share2, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fetchEventsByOrganizer } from '@/lib/api/events'
import { formatCurrency as formatPrice } from '@/lib/utils/format'

interface Lot {
  id: string
  name: string
  price: number
  totalQuantity: number
  availableQuantity: number
  startDate: string
  endDate: string
  isActive: boolean
}

interface Event {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string | null
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  imageUrl: string | null
  isPublished: boolean
  halfPriceEnabled: boolean
  halfPriceLimit: number
  halfPriceElderlyFree: boolean
  organizer: {
    id: string
    name: string
  }
  lots: Lot[]
}

interface WaitlistEntry {
  id: string
  position: number
  notified: boolean
  lotId: string | null
  lot: {
    id: string
    name: string
    price: number
  } | null
}

interface EventDetailClientProps {
  event: Event
}

/**
 * Generate Google Maps Embed API URL for event location
 * Uses the embed API in place mode for no API key requirement
 */
const getGoogleMapsEmbedUrl = (event: Event): string => {
  const addressParts = [
    event.address,
    event.location,
    event.city,
    event.state
  ].filter(Boolean).join(', ')

  // Use embed API v1 place mode (no API key required)
  const encodedAddress = encodeURIComponent(addressParts)
  return `https://www.google.com/maps?q=${encodedAddress}&output=embed`
}

/**
 * Generate Google Maps directions URL for opening in new tab
 */
const getGoogleMapsDirectionsUrl = (event: Event): string => {
  const addressParts = [
    event.address,
    event.location,
    event.city,
    event.state
  ].filter(Boolean).join(', ')

  const encodedAddress = encodeURIComponent(addressParts)
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
}

export function EventDetailClient({ event }: EventDetailClientProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)
  const [leavingWaitlist, setLeavingWaitlist] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([])
  const [organizerEvents, setOrganizerEvents] = useState<Event[]>([])
  const [loadingOrganizerEvents, setLoadingOrganizerEvents] = useState(true)
  const [previousAvailability, setPreviousAvailability] = useState<Record<string, number>>({})
  const [availabilityChanged, setAvailabilityChanged] = useState(false)

  // Real-time lot availability fetch using SWR with polling
  // Refreshes every 10 seconds to get latest ticket availability
  // This prevents overselling by showing users current stock
  const { data: realtimeEvent, error: realtimeError } = useApi<{ event: Event }>(
    `/api/events/${event.id}`,
    {
      refreshInterval: 10000, // Poll every 10 seconds
      revalidateOnFocus: true, // Also refresh when user returns to tab
      dedupingInterval: 5000, // Don't make duplicate requests within 5 seconds
    }
  )

  // Use real-time event data when available, otherwise use initial event data
  const currentEvent = realtimeEvent?.event || event

  // Track availability changes to show visual feedback
  useEffect(() => {
    if (realtimeEvent?.event?.lots) {
      const currentAvailability: Record<string, number> = {}
      let hasChanged = false

      realtimeEvent.event.lots.forEach((lot: Lot) => {
        currentAvailability[lot.id] = lot.availableQuantity

        // Check if availability changed from previous value
        if (previousAvailability[lot.id] !== undefined &&
            previousAvailability[lot.id] !== lot.availableQuantity) {
          hasChanged = true

          // Show notification if lot sold out or low stock
          if (lot.availableQuantity === 0 && previousAvailability[lot.id] > 0) {
            showToast('error', `${lot.name} acabou de esgotar!`)
          } else if (lot.availableQuantity > 0 && lot.availableQuantity <= 5 &&
                     previousAvailability[lot.id] > 5) {
            showToast('warning', `Últimas unidades: ${lot.name}`)
          }
        }
      })

      setPreviousAvailability(currentAvailability)

      if (hasChanged) {
        setAvailabilityChanged(true)
        // Hide the indicator after 3 seconds
        setTimeout(() => setAvailabilityChanged(false), 3000)
      }
    }
  }, [realtimeEvent?.event?.lots])

  const fetchOrganizerEvents = async () => {
    try {
      setLoadingOrganizerEvents(true)
      const data = await fetchEventsByOrganizer(currentEvent.organizer.id, {
        published: true,
        pageSize: 6,
        excludeEventId: currentEvent.id,
      })
      setOrganizerEvents(data.events)
    } catch (err) {
      console.error('Failed to fetch organizer events:', err)
      // Don't show error for this - it's optional content
    } finally {
      setLoadingOrganizerEvents(false)
    }
  }

  useEffect(() => {
    fetchWaitlistStatus(event.id)
    fetchOrganizerEvents()
    // Initialize previous availability tracking
    if (event.lots) {
      const availability: Record<string, number> = {}
      event.lots.forEach(lot => {
        availability[lot.id] = lot.availableQuantity
      })
      setPreviousAvailability(availability)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  const fetchWaitlistStatus = useCallback(async (eventId: string) => {
    try {
      const response = await fetch(`/api/waitlist?eventId=${eventId}`)
      const data = await response.json()

      if (response.ok) {
        setWaitlistEntries(data.entries || [])
      }
    } catch (err) {
      // Don't show error for waitlist status fetch - it's optional
      console.error('Failed to fetch waitlist status:', err)
    }
  }, [])

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

  const getActiveLot = (lots: Lot[]) => {
    const now = new Date()
    return lots.find(
      lot => lot.isActive &&
      new Date(lot.startDate) <= now &&
      new Date(lot.endDate) >= now &&
      lot.availableQuantity > 0
    )
  }

  const getSoldOutLots = (lots: Lot[]) => {
    const now = new Date()
    return lots.filter(
      lot => lot.isActive &&
      new Date(lot.startDate) <= now &&
      new Date(lot.endDate) >= now &&
      lot.availableQuantity === 0
    )
  }

  const getAvailableLots = (lots: Lot[]) => {
    const now = new Date()
    return lots.filter(
      lot => lot.isActive &&
      new Date(lot.startDate) <= now &&
      new Date(lot.endDate) >= now
    ).sort((a, b) => {
      // Sort by price (ascending) - cheaper lots first
      if (a.price !== b.price) return a.price - b.price
      // Then by availability (more available first)
      return b.availableQuantity - a.availableQuantity
    })
  }

  const getUpcomingLots = (lots: Lot[]) => {
    const now = new Date()
    return lots.filter(
      lot => lot.isActive &&
      new Date(lot.startDate) > now
    ).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  }

  const getLotProgression = (lots: Lot[]) => {
    const now = new Date()
    const activeLots = lots.filter(lot =>
      lot.isActive &&
      new Date(lot.startDate) <= now &&
      new Date(lot.endDate) >= now
    )

    return {
      current: activeLots.find(lot => lot.availableQuantity > 0),
      soldOut: activeLots.filter(lot => lot.availableQuantity === 0),
      upcoming: lots.filter(lot => lot.isActive && new Date(lot.startDate) > now),
      expired: lots.filter(lot => lot.isActive && new Date(lot.endDate) < now)
    }
  }

  const handleBuyNow = (lotId: string) => {
    const selectedLotForPurchase = currentEvent.lots.find(lot => lot.id === lotId)
    if (!selectedLotForPurchase || selectedLotForPurchase.availableQuantity < selectedQuantity) {
      showToast('error', 'Desculpe, ingressos esgotados ou quantidade indisponível. Atualizamos a disponibilidade.')
      return
    }

    const queryParams = new URLSearchParams({
      event: currentEvent.id,
      lot: lotId,
      quantity: selectedQuantity.toString()
    })
    router.push(`/checkout?${queryParams.toString()}`)
  }

  const handleJoinWaitlist = async (lotId: string) => {
    setJoiningWaitlist(true)
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: currentEvent.id,
          lotId
        })
      })

      if (response.ok) {
        showToast('success', 'Você foi adicionado à lista de espera!')
        await fetchWaitlistStatus(currentEvent.id)
      } else {
        const data = await response.json()
        showToast('error', data.error || 'Erro ao entrar na lista de espera')
      }
    } catch (err) {
      showToast('error', 'Erro ao entrar na lista de espera')
    } finally {
      setJoiningWaitlist(false)
    }
  }

  const handleLeaveWaitlist = async (entryId: string, lotId: string) => {
    setLeavingWaitlist(entryId)
    try {
      const response = await fetch('/api/waitlist/leave', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: currentEvent.id,
          lotId
        })
      })

      if (response.ok) {
        showToast('success', 'Você saiu da lista de espera')
        await fetchWaitlistStatus(currentEvent.id)
      } else {
        const data = await response.json()
        showToast('error', data.error || 'Erro ao sair da lista de espera')
      }
    } catch (err) {
      showToast('error', 'Erro ao sair da lista de espera')
    } finally {
      setLeavingWaitlist(null)
    }
  }

  const handleCopyLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopiedLink(true)
      showToast('success', 'Link copiado com sucesso!')
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      showToast('error', 'Erro ao copiar link')
    }
  }

  const getShareUrls = () => {
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(`Confira este evento: ${currentEvent.title}`)

    return {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`
    }
  }

  const shareUrls = getShareUrls()

  const getLotStatusBadge = (lot: Lot) => {
    const now = new Date()
    const isActive = lot.isActive && new Date(lot.startDate) <= now && new Date(lot.endDate) >= now

    if (!isActive) {
      return <Badge variant="neutral" size="sm">Encerrado</Badge>
    }
    if (lot.availableQuantity === 0) {
      return <Badge variant="error" size="sm">Esgotado</Badge>
    }
    if (lot.availableQuantity < lot.totalQuantity * 0.2) {
      return <Badge variant="warning" size="sm">Últimas unidades</Badge>
    }
    return <Badge variant="success" size="sm">Disponível</Badge>
  }

  const getWaitlistEntryForLot = (lotId: string) => {
    return waitlistEntries.find(entry => entry.lotId === lotId)
  }

  // Use real-time event data for lot calculations
  const availableLots = getAvailableLots(currentEvent.lots)
  const upcomingLots = getUpcomingLots(currentEvent.lots)
  const soldOutLots = getSoldOutLots(currentEvent.lots)
  const lotProgression = getLotProgression(currentEvent.lots)
  const [selectedLotId, setSelectedLotId] = useState<string | null>(
    availableLots.length > 0 ? availableLots[0].id : null
  )

  // Update selected lot when available lots change
  useEffect(() => {
    if (availableLots.length > 0 && !selectedLotId) {
      setSelectedLotId(availableLots[0].id)
    } else if (availableLots.length > 0 && selectedLotId) {
      // Check if selected lot is still available
      const isSelectedLotAvailable = availableLots.some(lot => lot.id === selectedLotId)
      if (!isSelectedLotAvailable) {
        setSelectedLotId(availableLots[0].id)
      }
    }
  }, [availableLots, selectedLotId])

  const selectedLot = availableLots.find(lot => lot.id === selectedLotId) || availableLots[0]

  return (
    <>
      {/* Share buttons */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-4">
            <Share2 className="w-[1rem] h-[1rem] text-neutral-600" aria-hidden="true" />
            <span className="text-sm font-medium text-neutral-700">Compartilhar:</span>
          </div>

          <a
            href={shareUrls.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-4 px-4 py-2 bg-success-500 text-white rounded-xl hover:bg-success-600 transition-colors focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2 shadow-card"
            aria-label="Compartilhar no WhatsApp"
          >
            <svg className="w-[1rem] h-[1rem]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="text-sm font-medium">WhatsApp</span>
          </a>

          <a
            href={shareUrls.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-4 px-4 py-2 bg-neutral-950 text-white rounded-xl hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 shadow-card"
            aria-label="Compartilhar no X (Twitter)"
          >
            <svg className="w-[1rem] h-[1rem]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="text-sm font-medium">X</span>
          </a>

          <a
            href={shareUrls.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-4 px-4 py-2 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 shadow-card"
            aria-label="Compartilhar no Facebook"
          >
            <svg className="w-[1rem] h-[1rem]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-sm font-medium">Facebook</span>
          </a>

          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-4 px-4 py-2 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 shadow-card"
            aria-label="Copiar link do evento"
          >
            {copiedLink ? (
              <Check className="w-[1rem] h-[1rem] text-success-600" />
            ) : (
              <Copy className="w-[1rem] h-[1rem] text-neutral-600" />
            )}
            <span className="text-sm font-medium text-neutral-700">
              {copiedLink ? 'Copiado!' : 'Copiar link'}
            </span>
          </button>

          <Badge variant={event.isPublished ? 'success' : 'neutral'} size="md">
            {event.isPublished ? 'Publicado' : 'Rascunho'}
          </Badge>
        </div>

        {/* Real-time availability indicator */}
        {availabilityChanged && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl animate-pulse">
            <AlertCircle className="w-[1rem] h-[1rem] text-primary-600" aria-hidden="true" />
            <span className="text-sm text-primary-700">
              Disponibilidade de ingressos atualizada!
            </span>
          </div>
        )}
      </div>

      {/* Responsive layout: stacks on mobile, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content - left on desktop, top on mobile */}
        <div className="flex-1 order-2 lg:order-1">
          {event.imageUrl && (
            <div className="bg-neutral-200 rounded-2xl overflow-hidden mb-6">
              <Image
                src={event.imageUrl}
                alt={event.title}
                width={800}
                height={400}
                className="w-full h-64 sm:h-80 lg:h-96 object-cover"
                priority
              />
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-card border border-neutral-200/60 p-6">
            <div className="space-y-4 mb-6">
              <div className="flex items-start">
                <Calendar className="w-5 h-5 mr-3 mt-0.5 text-primary-500" aria-hidden="true" />
                <div>
                  <div className="text-neutral-900 font-medium">
                    {formatDate(event.startTime)}
                  </div>
                  {event.endTime && (
                    <div className="text-neutral-600">
                      até {formatDate(event.endTime)}
                    </div>
                  )}
                </div>
              </div>

              {event.location && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 mt-0.5 text-primary-500" aria-hidden="true" />
                  <div className="flex-1">
                    <div className="text-neutral-900 font-medium">{event.location}</div>
                    {event.address && (
                      <div className="text-neutral-600">{event.address}</div>
                    )}
                    {event.city && event.state && (
                      <div className="text-neutral-600">
                        {event.city}, {event.state}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-start">
                <User className="w-5 h-5 mr-3 mt-0.5 text-primary-500" aria-hidden="true" />
                <div>
                  <div className="text-neutral-900 font-medium">Organizador</div>
                  <div className="text-neutral-600">{event.organizer.name}</div>
                </div>
              </div>
            </div>

            <div className="prose max-w-none">
              <h3 className="text-xl font-display font-semibold text-neutral-900 mb-3">
                Sobre o evento
              </h3>
              <p className="text-neutral-700 whitespace-pre-line">
                {event.description}
              </p>
            </div>

            {/* Embedded Map */}
            {event.location && (event.address || (event.city && event.state)) && (
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h3 className="text-xl font-display font-semibold text-neutral-900 mb-4">
                  Localização
                </h3>
                <div className="relative w-full h-64 sm:h-80 lg:h-96 bg-neutral-100 rounded-2xl overflow-hidden border border-neutral-200/60">
                  <iframe
                    title={`Mapa de localização: ${event.location}`}
                    src={getGoogleMapsEmbedUrl(event)}
                    className="absolute top-0 left-0 w-full h-full border-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                {(event.address || event.city) && (
                  <a
                    href={getGoogleMapsDirectionsUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-4 mt-4 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    aria-label="Ver rotas no Google Maps"
                  >
                    <MapPin className="w-[1rem] h-[1rem]" aria-hidden="true" />
                    <span className="text-sm font-medium">Ver rotas no Google Maps</span>
                  </a>
                )}
              </div>
            )}

            {/* Organizer Profile & Other Events */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-display font-semibold text-neutral-900">
                  Sobre o Organizador
                </h3>
              </div>

              {/* Organizer Info Card */}
              <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl p-6 mb-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-display font-bold text-lg flex-shrink-0">
                    {event.organizer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-neutral-900 mb-1">
                      {event.organizer.name}
                    </h4>
                    <p className="text-sm text-neutral-600">
                      Organizador de eventos
                    </p>
                  </div>
                </div>
              </div>

              {/* Other Events by Same Organizer */}
              {loadingOrganizerEvents ? (
                <div>
                  <h4 className="text-lg font-display font-semibold text-neutral-900 mb-4">
                    Outros Eventos do Organizador
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                  </div>
                </div>
              ) : organizerEvents.length > 0 ? (
                <div>
                  <h4 className="text-lg font-display font-semibold text-neutral-900 mb-4">
                    Outros Eventos do Organizador
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {organizerEvents.map((organizerEvent) => (
                      <EventCard
                        key={organizerEvent.id}
                        event={organizerEvent}
                        href={`/events/${organizerEvent.id}`}
                        imageSize="sm"
                        showDescription={false}
                        showPrice={false}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Sidebar - right on desktop, below on mobile */}
        <div className="w-full lg:w-96 order-1 lg:order-2">
          <div className="bg-white rounded-2xl shadow-card border border-neutral-200/60 p-6 lg:sticky lg:top-4">
            <h3 className="text-xl font-display font-semibold text-neutral-900 mb-4">
              Ingressos Disponíveis
            </h3>

            {availableLots.length > 0 ? (
              <div className="space-y-4">
                {/* Available lots with selection */}
                <div className="space-y-3">
                  <fieldset>
                    <legend className="sr-only">Selecione um tipo de ingresso</legend>
                    {availableLots.map((lot) => (
                      <label
                        key={lot.id}
                        className={cn(
                          "block cursor-pointer transition-all duration-200",
                          selectedLotId === lot.id ? "ring-2 ring-primary-500" : ""
                        )}
                      >
                        <input
                          type="radio"
                          name="lot-selection"
                          value={lot.id}
                          checked={selectedLotId === lot.id}
                          onChange={() => setSelectedLotId(lot.id)}
                          className="sr-only"
                        />
                        <div className={cn(
                          "border rounded-xl p-4 transition-colors",
                          selectedLotId === lot.id
                            ? "border-primary-500 bg-primary-50/50"
                            : "border-neutral-200 hover:border-neutral-300"
                        )}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-4 mb-4">
                                <div className={cn(
                                  "w-[1rem] h-[1rem] rounded-full border-2 flex items-center justify-center",
                                  selectedLotId === lot.id
                                    ? "border-primary-500 bg-primary-500"
                                    : "border-neutral-300"
                                )}>
                                  {selectedLotId === lot.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                                <span className="text-sm font-medium text-neutral-900">
                                  {lot.name}
                                </span>
                              </div>
                              <div>
                                <div className="text-2xl font-display font-bold text-success-600">
                                  {formatPrice(lot.price)}
                                </div>
                                {currentEvent.halfPriceEnabled && (
                                  <div className="text-sm text-primary-600 font-medium">
                                    Meia: {formatPrice(lot.price / 2)}
                                  </div>
                                )}
                              </div>
                            </div>
                            {getLotStatusBadge(lot)}
                          </div>

                          {/* Availability indicator */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm text-neutral-600 mb-4">
                              <span>Disponibilidade</span>
                              <span className="font-medium">
                                {lot.availableQuantity} / {lot.totalQuantity}
                              </span>
                            </div>
                            <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  lot.availableQuantity === 0
                                    ? "bg-error-500"
                                    : lot.availableQuantity < lot.totalQuantity * 0.2
                                    ? "bg-warning-500"
                                    : "bg-success-500"
                                )}
                                style={{
                                  width: `${Math.max(0, (lot.availableQuantity / lot.totalQuantity) * 100)}%`
                                }}
                                role="progressbar"
                                aria-valuenow={lot.availableQuantity}
                                aria-valuemin={0}
                                aria-valuemax={lot.totalQuantity}
                                aria-label={`${lot.availableQuantity} ingressos disponíveis de ${lot.totalQuantity}`}
                              />
                            </div>
                            {lot.availableQuantity > 0 && lot.availableQuantity <= lot.totalQuantity * 0.2 && (
                              <p className="text-sm text-warning-600 mt-4" role="status" aria-live="polite">
                                Últimas unidades disponíveis!
                              </p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </fieldset>
                </div>

                {/* Half-price ticket options */}
                {currentEvent.halfPriceEnabled && selectedLot && (
                  <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-8">
                      <Info className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-primary-900 mb-8">
                          Meia-entrada disponível
                        </h4>
                        <p className="text-sm text-primary-700 mb-8">
                          {formatPrice(selectedLot.price / 2)} para elegíveis ({currentEvent.halfPriceLimit}% dos ingressos)
                        </p>
                        <div className="space-y-8">
                          <p className="text-sm text-primary-600 font-medium">Quem tem direito:</p>
                          <ul className="space-y-4">
                            <li className="text-sm text-primary-700 flex items-start gap-4">
                              <span className="font-semibold">• Estudantes:</span>
                              <span>Com carteira de estudante válida (CIE)</span>
                            </li>
                            <li className="text-sm text-primary-700 flex items-start gap-4">
                              <span className="font-semibold">• Pessoas com deficiência:</span>
                              <span>Com documento de comprovação</span>
                            </li>
                            <li className="text-sm text-primary-700 flex items-start gap-4">
                              <span className="font-semibold">• Jovens (15-29 anos):</span>
                              <span>Com ID Jovem ou comprovação de baixa renda</span>
                            </li>
                            <li className="text-sm text-primary-700 flex items-start gap-4">
                              <span className="font-semibold">
                                • Idosos ({currentEvent.halfPriceElderlyFree ? 'sem limite' : `até ${currentEvent.halfPriceLimit}%`}):
                              </span>
                              <span>Com documento de identidade</span>
                            </li>
                          </ul>
                        </div>
                        <p className="text-sm text-primary-600 mt-8 italic">
                          Documentos serão verificados no entrada do evento.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity selector and purchase button for selected lot */}
                {selectedLot && (
                  <div className="border-t border-neutral-200 pt-4">
                    <div className="mb-4">
                      <label htmlFor="quantity" className="block text-sm font-medium text-neutral-700 mb-2">
                        Quantidade
                      </label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                          disabled={selectedQuantity <= 1}
                          className="w-10 h-10 rounded-xl border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                          aria-label="Diminuir quantidade"
                        >
                          -
                        </button>
                        <input
                          id="quantity"
                          type="number"
                          min="1"
                          max={selectedLot.availableQuantity}
                          value={selectedQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            setSelectedQuantity(Math.min(Math.max(1, val), selectedLot.availableQuantity))
                          }}
                          className="w-20 text-center border border-neutral-200 rounded-xl py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedQuantity(Math.min(selectedLot.availableQuantity, selectedQuantity + 1))}
                          disabled={selectedQuantity >= selectedLot.availableQuantity}
                          className="w-10 h-10 rounded-xl border border-neutral-200 flex items-center justify-center hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                          aria-label="Aumentar quantidade"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <Button
                      variant="gradient"
                      size="lg"
                      fullWidth
                      onClick={() => handleBuyNow(selectedLot.id)}
                    >
                      Comprar Agora
                    </Button>

                    <div className="text-sm text-neutral-600 mt-4 text-center">
                      Válido até {formatDate(selectedLot.endDate)}
                    </div>
                  </div>
                )}
              </div>
            ) : currentEvent.lots.length === 0 ? (
              <div className="text-neutral-600 text-center py-8">
                Nenhum lote disponível
              </div>
            ) : null}

            {/* Upcoming lots */}
            {upcomingLots.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h4 className="text-sm font-display font-semibold text-neutral-900 mb-4 flex items-center gap-4">
                  <Calendar className="w-[1rem] h-[1rem] text-primary-500" aria-hidden="true" />
                  Próximos Lotes
                </h4>
                <div className="space-y-3">
                  {upcomingLots.map((lot) => (
                    <article key={lot.id} className="border border-neutral-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-neutral-700">
                          {lot.name}
                        </div>
                        <Badge variant="neutral" size="sm">Em breve</Badge>
                      </div>
                      <div className="text-sm text-neutral-600 mb-1">
                        {formatPrice(lot.price)}
                      </div>
                      <div className="text-sm text-neutral-600">
                        Início: {formatDate(lot.startDate)}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Sold out lots with waitlist option */}
            {soldOutLots.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h4 className="text-sm font-display font-semibold text-neutral-900 mb-3">
                  Lotes Esgotados
                </h4>
                <div className="space-y-4">
                  {soldOutLots.map((lot) => {
                    const waitlistEntry = getWaitlistEntryForLot(lot.id)
                    return (
                      <article key={lot.id} className="border border-neutral-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-neutral-700">
                            {lot.name}
                          </div>
                          <Badge variant="error" size="sm">Esgotado</Badge>
                        </div>
                        <div className="text-sm text-neutral-600 mb-3">
                          {formatPrice(lot.price)}
                        </div>
                        {waitlistEntry ? (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm" role="status" aria-live="polite">
                              <span className="text-neutral-600">Sua posição:</span>
                              <span className="font-display font-semibold text-primary-600">
                                #{waitlistEntry.position}
                              </span>
                            </div>
                            {waitlistEntry.notified && (
                              <div className="text-sm text-success-600 bg-success-50 px-3 py-2 rounded-xl" role="status" aria-live="polite">
                                Você foi notificado! Ingressos disponíveis.
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              fullWidth
                              loading={leavingWaitlist === waitlistEntry.id}
                              onClick={() => handleLeaveWaitlist(waitlistEntry.id, lot.id)}
                            >
                              Sair da Lista de Espera
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            fullWidth
                            loading={joiningWaitlist}
                            onClick={() => handleJoinWaitlist(lot.id)}
                          >
                            Entrar na Lista de Espera
                          </Button>
                        )}
                      </article>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lot progression summary */}
            {lotProgression.expired.length > 0 && (
              <div className="mt-6 pt-6 border-t border-neutral-200">
                <h4 className="text-sm font-display font-semibold text-neutral-900 mb-3">
                  Lotes Encerrados
                </h4>
                <div className="space-y-2">
                  {lotProgression.expired.slice(0, 3).map((lot) => (
                    <div key={lot.id} className="flex justify-between items-center text-sm text-neutral-600">
                      <span>{lot.name}</span>
                      <span>{formatPrice(lot.price)}</span>
                    </div>
                  ))}
                  {lotProgression.expired.length > 3 && (
                    <div className="text-sm text-neutral-500 text-center">
                      +{lotProgression.expired.length - 3} lotes encerrados
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
