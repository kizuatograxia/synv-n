import type { Metadata } from 'next'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { PageHeader } from '@/components/layout/page-header'
import { EventDetailClient } from './event-detail-client'
import { type Event } from '@/lib/api/events'
import { prisma } from '@/lib/db/prisma'
import { cn } from '@/lib/cn'

async function getEventById(id: string): Promise<Event | null> {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, name: true, email: true } },
      lots: { orderBy: { startDate: 'asc' } },
      sessions: { orderBy: { startTime: 'asc' } },
      seatMaps: {
        include: {
          sectors: { include: { lots: true } },
          _count: { select: { seats: true } },
        },
      },
    },
  })
  if (!event) return null
  return JSON.parse(JSON.stringify(event))
}

interface PageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Generate JSON-LD structured data for Schema.org Event type
 * This helps search engines understand event content for rich snippets
 */
function generateEventJsonLd(event: Event): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://simprao.com.br'
  const eventUrl = `${baseUrl}/events/${event.id}`

  // Build location object based on event type
  let location: any = {
    '@type': 'VirtualLocation',
    url: eventUrl,
  }

  if (event.location || event.address) {
    location = {
      '@type': 'Place',
      name: event.location || event.city || 'Local a definir',
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address || undefined,
        addressLocality: event.city || undefined,
        addressRegion: event.state || undefined,
        addressCountry: 'BR',
      },
    }
  }

  // Get minimum price from active lots
  const activeLots = event.lots.filter(lot => lot.isActive && lot.availableQuantity > 0)
  const minPrice = activeLots.length > 0
    ? Math.min(...activeLots.map(lot => lot.price))
    : 0

  // Build offers object
  const offers: any = {
    '@type': 'Offer',
    url: eventUrl,
    price: minPrice,
    priceCurrency: 'BRL',
    availability: activeLots.some(lot => lot.availableQuantity > 0)
      ? 'https://schema.org/InStock'
      : 'https://schema.org/SoldOut',
    validFrom: activeLots.length > 0 ? activeLots[0].startDate : event.startTime,
  }

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    url: eventUrl,
    startDate: event.startTime,
    endDate: event.endTime || undefined,
    eventAttendanceMode: event.location || event.address
      ? 'https://schema.org/OfflineEventAttendanceMode'
      : 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location,
    organizer: {
      '@type': 'Organization',
      name: event.organizer.name,
    },
    offers: minPrice > 0 ? offers : undefined,
    image: event.imageUrl || undefined,
    inLanguage: 'pt-BR',
  }

  // Remove undefined values
  Object.keys(jsonLd).forEach(key => {
    if (jsonLd[key] === undefined) {
      delete jsonLd[key]
    }
  })

  return JSON.stringify(jsonLd)
}

/**
 * Generate dynamic metadata for event detail page
 * This improves SEO by providing unique title, description, and Open Graph tags
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEventById(id)

  if (!event) {
    return {
      title: 'Evento não encontrado - Simprão',
    }
  }

  const startDate = new Date(event.startTime).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const startTime = new Date(event.startTime).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const location = event.location || event.city
    ? `${event.location ? event.location + ' - ' : ''}${event.city || ''}${event.state ? ', ' + event.state : ''}`
    : 'Online'

  const description = event.description
    ? `${event.description.slice(0, 160)}${event.description.length > 160 ? '...' : ''}`
    : `${event.title} - ${startDate} às ${startTime} - ${location}`

  return {
    title: `${event.title} - Simprão`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'website',
      locale: 'pt_BR',
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://simprao.com.br'}/events/${id}`,
      siteName: 'Simprão',
      images: event.imageUrl
        ? [
            {
              url: event.imageUrl,
              width: 1200,
              height: 630,
              alt: event.title,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: event.imageUrl ? [event.imageUrl] : [],
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://simprao.com.br'}/events/${id}`,
    },
  }
}

/**
 * Event detail page with SSR and streaming
 *
 * This page uses Server-Side Rendering with React Streaming to provide:
 * - Fast initial HTML render with loading shells
 * - Progressive data loading as the page streams
 * - SEO-friendly server-rendered content
 *
 * The page structure streams in this order:
 * 1. Shell (Header, PageHeader) - immediate
 * 2. Event data (title, image, description) - fast
 * 3. Interactive elements (waitlist, ticket selector) - client component
 */
export default async function EventDetailPage({ params }: PageProps) {
  const { id } = await params

  try {
    // Fetch event data on the server
    const event = await getEventById(id)

    if (!event) {
      return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
          <Header />
          <main className="flex-1 flex items-center justify-center px-4">
            <div className="text-center max-w-md">
              <h1 className={cn("text-3xl font-display font-bold text-neutral-900 mb-3")}>
                Evento não encontrado
              </h1>
              <p className="text-neutral-600 mb-6 text-lg">
                O evento que você procura não existe ou foi removido.
              </p>
              <a
                href="/events"
                className={cn(
                  "inline-flex items-center justify-center px-6 py-3",
                  "gradient-primary text-white font-semibold rounded-xl",
                  "hover:opacity-90 transition-all duration-200",
                  "shadow-lg shadow-coral-500/30 hover:shadow-xl hover:shadow-coral-500/40"
                )}
              >
                Ver Eventos
              </a>
            </div>
          </main>
          <Footer />
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: generateEventJsonLd(event),
          }}
        />
        <Header />
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 flex-1">
          <PageHeader
            title={event.title}
            breadcrumbs={[
              { label: 'Eventos', href: '/events' },
              { label: event.title },
            ]}
          />
          <EventDetailClient event={event} />
        </main>
        <Footer />
      </div>
    )
  } catch (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className={cn("text-3xl font-display font-bold text-neutral-900 mb-3")}>
              Erro ao Carregar Evento
            </h1>
            <p className="text-neutral-600 mb-6 text-lg">
              Não foi possível carregar os detalhes do evento. Tente novamente mais tarde.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a
                href="/events"
                className={cn(
                  "inline-flex items-center justify-center px-6 py-3",
                  "gradient-primary text-white font-semibold rounded-xl",
                  "hover:opacity-90 transition-all duration-200",
                  "shadow-lg shadow-coral-500/30 hover:shadow-xl hover:shadow-coral-500/40"
                )}
              >
                Ver Eventos
              </a>
              <a
                href="."
                className={cn(
                  "inline-flex items-center justify-center px-6 py-3",
                  "border-2 border-neutral-300 text-neutral-700 font-semibold rounded-xl",
                  "hover:bg-neutral-100 hover:border-neutral-400 transition-all duration-200"
                )}
              >
                Tentar Novamente
              </a>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }
}
