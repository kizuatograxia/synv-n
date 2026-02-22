import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'

export interface EventCardProps {
  event: {
    id: string
    title: string
    description: string
    startTime: string
    endTime: string | null
    location: string | null
    city: string | null
    state: string | null
    imageUrl: string | null
    lots: Array<{
      id: string
      name: string
      price: number
      availableQuantity: number
      totalQuantity?: number
    }>
  }
  href: string
  imageSize?: 'sm' | 'md' | 'lg'
  showDate?: boolean
  showLocation?: boolean
  showPrice?: boolean
  showDescription?: boolean
}

/**
 * EventCard component - ticket360.com.br style
 * - Date badge (day/month separated)
 * - Event/venue image
 * - Event title
 * - Venue name
 * - City and State
 * - Gate opening time
 * - Price from (when applicable)
 *
 * @param event - Event data object
 * @param href - Link destination
 * @param imageSize - Image height: sm (192px), md (256px), lg (384px). Default: md
 * @param showDate - Show date badge overlay. Default: true
 * @param showLocation - Show location information. Default: true
 * @param showPrice - Show pricing information. Default: true
 * @param showDescription - Show event description. Default: true
 */
export function EventCard({
  event,
  href,
  imageSize = 'md',
  showDate = true,
  showLocation = true,
  showPrice = true,
  showDescription = true,
}: EventCardProps) {
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

  const getLowestPrice = (lots: EventCardProps['event']['lots']) => {
    if (lots.length === 0) return null
    return Math.min(...lots.map(l => l.price))
  }

  // Format date badge - day and month separated (ticket360.com.br style)
  const formatDateBadge = (dateString: string) => {
    const date = new Date(dateString)
    return {
      day: date.getDate().toString().padStart(2, '0'),
      month: date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()
    }
  }

  const dateBadge = formatDateBadge(event.startTime)
  const lowestPrice = getLowestPrice(event.lots)

  const imageHeightClasses = {
    sm: 'h-48',
    md: 'h-56',
    lg: 'h-96'
  }

  return (
    <Link
      href={href}
      className={cn(
        "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
        "rounded-xl block group"
      )}
    >
      <Card hover className="h-full shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
        <div className="relative">
          {event.imageUrl ? (
            <div className={cn("bg-gray-200 relative overflow-hidden", imageHeightClasses[imageSize])}>
              <Image
                src={event.imageUrl}
                alt={event.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          ) : (
            <div className={cn(
              "bg-gradient-to-br from-accent-100 via-accent-50 to-purple-100 flex items-center justify-center",
              imageHeightClasses[imageSize]
            )}>
              <Calendar className="w-16 h-16 text-accent-300" />
            </div>
          )}
          {/* Date Badge Overlay - ticket360.com.br style (day/month separated) */}
          {showDate && (
            <div className="absolute top-3 left-3">
              <div className="bg-white rounded-lg shadow-md px-3 py-2 text-center min-w-[50px]">
                <div className="text-xl font-bold text-accent leading-none">
                  {dateBadge.day}
                </div>
                <div className="text-xs font-semibold text-light-secondary uppercase mt-0.5">
                  {dateBadge.month}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className={cn(
            "text-base font-display font-semibold text-light-text mb-2 line-clamp-1",
            "group-hover:text-accent transition-colors"
          )}>
            {event.title}
          </h3>

          {/* Venue/Location - ticket360.com.br style */}
          {showLocation && event.location && (
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" aria-hidden="true" />
              <span className="text-sm text-light-secondary line-clamp-1">
                {event.location}
              </span>
            </div>
          )}

          {/* City and State - ticket360.com.br style */}
          {showLocation && event.city && event.state && (
            <div className="flex items-start gap-2 mb-2">
              <span className="w-4 h-4 mt-0.5 flex-shrink-0"></span>
              <span className="text-sm text-light-secondary">
                {event.city}, {event.state}
              </span>
            </div>
          )}

          {/* Gate opening time - ticket360.com.br style */}
          <div className="flex items-start gap-2 mb-3">
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-light-secondary" aria-hidden="true" />
            <span className="text-sm text-light-secondary">
              Abertura dos portões: {formatDate(event.startTime)}
            </span>
          </div>

          {showDescription && event.description && (
            <p className="text-sm text-light-secondary mb-3 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {/* Price from - ticket360.com.br style */}
        {showPrice && lowestPrice && (
          <div className="mt-auto px-4 pb-4 pt-3 border-t border-light-border bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs text-light-secondary uppercase tracking-wide font-medium">
                A partir de
              </span>
              <span className="text-lg font-bold text-accent">
                {formatPrice(lowestPrice)}
              </span>
            </div>
          </div>
        )}
      </Card>
    </Link>
  )
}
