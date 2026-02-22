import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { HeroCarousel } from '@/components/layout/hero-carousel'
import { ErrorWrapper } from '@/components/error-wrapper'
import { Calendar, MapPin, Sparkles, Shield, Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Simprão - Plataforma de Eventos',
  description: 'Descubra e compre ingressos para os melhores eventos: shows, palestras, workshops, cursos e muito mais. Compra segura e ingressos via QR code.',
  openGraph: {
    title: 'Simprão - Plataforma de Eventos',
    description: 'Descubra e compre ingressos para os melhores eventos: shows, palestras, workshops, cursos e muito mais.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://simprao.com.br',
    siteName: 'Simprão',
  },
  alternates: {
    canonical: 'https://simprao.com.br',
  },
}

interface Event {
  id: string
  title: string
  description: string
  startTime: string
  location: string | null
  city: string | null
  state: string | null
  imageUrl: string | null
  lots: Array<{
    id: string
    name: string
    price: number
    availableQuantity: number
  }>
}

async function getFeaturedEvents(): Promise<Event[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/events?published=true`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return (data.events || []).slice(0, 6)
  } catch (error) {
    console.error('Error fetching featured events:', error)
    return []
  }
}

export default async function Home() {
  const featuredEvents = await getFeaturedEvents()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString)
    return {
      day: date.toLocaleDateString('pt-BR', { day: '2-digit' }),
      month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price)
  }

  const getLowestPrice = (lots: Event['lots']) => {
    if (lots.length === 0) return null
    return Math.min(...lots.map(l => l.price))
  }

  return (
    <ErrorWrapper>
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1">
          {/* Hero Carousel - Featured Events */}
          {featuredEvents.length > 0 ? (
            <HeroCarousel events={featuredEvents} autoPlayInterval={6000} />
          ) : (
            /* Fallback Hero Section when no events */
            <section className="relative bg-dark-bg overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
              <div className="relative container mx-auto px-4 py-20 md:py-32 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-neutral-300 text-sm mb-8 backdrop-blur-sm">
                  <Sparkles className="w-[1rem] h-[1rem] text-accent-400" />
                  A maior plataforma de eventos do Brasil
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-white mb-6 max-w-3xl mx-auto leading-tight">
                  Seus eventos,{' '}
                  <span className="text-accent">simplificados</span>
                </h1>
                <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-xl mx-auto leading-relaxed">
                  Descubra, compre e gerencie ingressos com facilidade
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href="/events"
                    className="px-8 py-3.5 text-base font-semibold text-white bg-accent hover:bg-accent-600 rounded-xl transition-all duration-200"
                  >
                    Explorar Eventos
                  </Link>
                  <Link
                    href="/auth/register"
                    className="px-8 py-3.5 text-base font-semibold text-white border border-white/20 rounded-xl hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
                  >
                    Criar Conta
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* Trust Bar */}
          <section className="border-b border-neutral-100 bg-white">
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 text-sm text-neutral-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-[1rem] h-[1rem] text-primary-500" />
                  <span>Pagamento seguro</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-[1rem] h-[1rem] text-primary-500" />
                  <span>Ingresso instantâneo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-[1rem] h-[1rem] text-primary-500" />
                  <span>+10.000 eventos</span>
                </div>
              </div>
            </div>
          </section>

          {/* Featured Events Section */}
          {featuredEvents.length > 0 && (
            <section className="container mx-auto px-4 py-16 md:py-20">
              <div className="flex justify-between items-end mb-10">
                <div>
                  <h2 className="text-3xl md:text-4xl font-display font-bold text-neutral-900">
                    Eventos em Destaque
                  </h2>
                  <p className="text-neutral-600 mt-2">Os melhores eventos acontecendo agora</p>
                </div>
                <Link
                  href="/events"
                  className="hidden sm:inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold text-sm gap-1 transition-colors"
                >
                  Ver todos
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredEvents.map((event, index) => {
                  const dateShort = formatDateShort(event.startTime)
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-2xl"
                    >
                      <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden hover:-translate-y-1">
                        <div className="relative h-52 bg-neutral-100 overflow-hidden">
                          {event.imageUrl ? (
                            <Image
                              src={event.imageUrl}
                              alt={event.title}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              className="object-cover group-hover:scale-105 transition-transform duration-500"
                              priority={index < 3}
                            />
                          ) : (
                            <div className="h-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center">
                              <Calendar className="w-12 h-12 text-primary-300" />
                            </div>
                          )}
                          {/* Date badge overlay */}
                          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 text-center shadow-sm">
                            <div className="text-lg font-bold text-neutral-900 leading-none">{dateShort.day}</div>
                            <div className="text-xs font-medium text-primary-600 uppercase">{dateShort.month}</div>
                          </div>
                        </div>
                        <div className="p-5">
                          <h3 className="text-lg font-display font-semibold text-neutral-900 mb-1.5 line-clamp-1 group-hover:text-primary-600 transition-colors">
                            {event.title}
                          </h3>
                          <p className="text-neutral-600 mb-3 line-clamp-2 text-sm leading-relaxed">
                            {event.description}
                          </p>
                          <div className="space-y-1.5 text-sm text-neutral-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                              <span className="truncate">{formatDate(event.startTime)}</span>
                            </div>
                            {(event.city || event.location) && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                                <span className="truncate">
                                  {event.city && event.state ? `${event.city}, ${event.state}` : event.location}
                                </span>
                              </div>
                            )}
                          </div>
                          {getLowestPrice(event.lots) !== null && (
                            <div className="mt-4 pt-4 border-t border-neutral-100">
                              <span className="text-lg font-bold text-primary-600">
                                A partir de {formatPrice(getLowestPrice(event.lots)!)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div className="text-center mt-10 sm:hidden">
                <Link
                  href="/events"
                  className="inline-flex items-center text-primary-600 hover:text-primary-700 font-semibold gap-1"
                >
                  Ver todos os eventos &rarr;
                </Link>
              </div>
            </section>
          )}
        </main>

        <Footer />
      </div>
    </ErrorWrapper>
  )
}
