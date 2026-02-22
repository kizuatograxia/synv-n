'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AuthenticatedAppShell } from '@/components/layout/app-shell'
import { Stat } from '@/components/ui/stat'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Ticket, Calendar, User, Wallet, Calendar as CalendarIcon, ArrowRight } from 'lucide-react'
import type { ApiError } from '@/hooks/useApi'
import { cn } from '@/lib/cn'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'

interface ProfileData {
  user: {
    id: string
    name: string
    email: string
    phone?: string
    cpf?: string
  }
  stats: {
    totalOrders: number
    totalTickets: number
    usedTickets: number
    upcomingEvents: number
  }
}

interface Order {
  id: string
  totalAmount: number
  paymentStatus: string
  event: {
    id: string
    title: string
    startTime: string
    imageUrl: string
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch profile data
      const profileResponse = await fetch('/api/profile?section=profile')
      if (!profileResponse.ok) {
        const data = await profileResponse.json()
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar perfil',
          status: profileResponse.status,
          code: data.code
        }
        setError(apiError)
        return
      }
      const profileData = await profileResponse.json()
      setProfile(profileData.profile)

      // Fetch orders to calculate total spent
      const ordersResponse = await fetch('/api/profile?section=orders')
      if (!ordersResponse.ok) {
        const data = await ordersResponse.json()
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar pedidos',
          status: ordersResponse.status,
          code: data.code
        }
        setError(apiError)
        return
      }
      const ordersData = await ordersResponse.json()
      setOrders(ordersData.orders)
    } catch (err) {
      const apiError: ApiError = {
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        status: undefined
      }
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    } else if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, fetchData, router])

  // Calculate total spent from approved orders
  const totalSpent = orders
    .filter(order => order.paymentStatus === 'APPROVED')
    .reduce((sum, order) => sum + order.totalAmount, 0)

  // Get upcoming events from orders
  const upcomingEvents = orders
    .filter(order =>
      order.paymentStatus === 'APPROVED' &&
      new Date(order.event.startTime) > new Date()
    )
    .sort((a, b) => new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime())
    .slice(0, 3)

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Skeleton className="w-full max-w-md animate-fade-in" />
      </div>
    )
  }

  return (
    <AuthenticatedAppShell>
      <main className="space-y-6 animate-fade-in">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-display font-bold text-neutral-900">Dashboard</h1>
          <p className="text-neutral-600 mt-2">
            Bem-vindo, {session?.user?.name}! Você está logado como {session?.user?.role}
          </p>
        </div>

        {error && (
          <ErrorState
            title="Erro ao Carregar Dados"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchData()}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          <Stat
            label="Meus Ingressos"
            value={profile?.stats.totalTickets ?? 0}
            icon={<Ticket className="w-5 h-5" />}
            className="shadow-card hover:shadow-card-hover transition-shadow"
          />
          <Stat
            label="Meus Eventos"
            value={profile?.stats.upcomingEvents ?? 0}
            icon={<Calendar className="w-5 h-5" />}
            className="shadow-card hover:shadow-card-hover transition-shadow"
          />
          <Stat
            label="Total Gasto"
            value={formatCurrency(totalSpent)}
            icon={<Wallet className="w-5 h-5" />}
            className="shadow-card hover:shadow-card-hover transition-shadow"
          />
        </div>

        {/* Quick Actions */}
        <div className="animate-slide-up">
          <h2 className="text-xl font-display font-bold text-neutral-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className={cn(
                "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-card-hover transition-all"
              )}
              onClick={() => router.push('/events')}
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary-600" />
                <span className="font-medium">Ver Eventos</span>
              </div>
              <ArrowRight className="w-[1rem] h-[1rem]" />
            </Button>

            <Button
              variant="outline"
              className={cn(
                "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-card-hover transition-all"
              )}
              onClick={() => router.push('/orders')}
            >
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-primary-600" />
                <span className="font-medium">Meus Pedidos</span>
              </div>
              <ArrowRight className="w-[1rem] h-[1rem]" />
            </Button>

            <Button
              variant="outline"
              className={cn(
                "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-card-hover transition-all"
              )}
              onClick={() => router.push('/profile')}
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary-600" />
                <span className="font-medium">Meu Perfil</span>
              </div>
              <ArrowRight className="w-[1rem] h-[1rem]" />
            </Button>
          </div>
        </div>

        {/* Role-based links */}
        {(session?.user?.role === 'ORGANIZER' || session?.user?.role === 'ADMIN') && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-display font-bold text-neutral-900 mb-4">Área do Organizador</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="soft"
                className={cn(
                  "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-card-hover transition-all"
                )}
                onClick={() => router.push('/organizer/dashboard')}
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-secondary-600" />
                  <span className="font-medium">Dashboard Organizador</span>
                </div>
                <ArrowRight className="w-[1rem] h-[1rem]" />
              </Button>

              <Button
                variant="gradient"
                className={cn(
                  "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-elevated transition-all"
                )}
                onClick={() => router.push('/organizer/events/new')}
              >
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-5 h-5" />
                  <span className="font-medium">Criar Evento</span>
                </div>
                <ArrowRight className="w-[1rem] h-[1rem]" />
              </Button>
            </div>
          </div>
        )}

        {session?.user?.role === 'ADMIN' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-display font-bold text-neutral-900 mb-4">Área do Administrador</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className={cn(
                  "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-card-hover transition-all"
                )}
                onClick={() => router.push('/admin/dashboard')}
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-error-600" />
                  <span className="font-medium">Dashboard Admin</span>
                </div>
                <ArrowRight className="w-[1rem] h-[1rem]" />
              </Button>

              <Button
                variant="outline"
                className={cn(
                  "flex items-center justify-between h-auto p-4 rounded-xl shadow-card hover:shadow-card-hover transition-all"
                )}
                onClick={() => router.push('/admin/users')}
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-error-600" />
                  <span className="font-medium">Gerenciar Usuários</span>
                </div>
                <ArrowRight className="w-[1rem] h-[1rem]" />
              </Button>
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-display font-bold text-neutral-900 mb-4">Próximos Eventos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingEvents.map((order, index) => (
                <Card
                  key={order.id}
                  className={cn(
                    "p-4 rounded-2xl shadow-card animate-scale-in",
                    index > 0 && "md:animate-delay-100",
                    index > 1 && "md:animate-delay-200"
                  )}
                  hover
                >
                  <div className="flex items-start gap-3">
                    {order.event.imageUrl && (
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <Image
                          src={order.event.imageUrl}
                          alt={order.event.title}
                          fill
                          sizes="64px"
                          className="object-cover rounded-xl"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-neutral-900 truncate">
                        {order.event.title}
                      </h3>
                      <p className="text-sm text-neutral-600 mt-1">
                        {formatDateTime(order.event.startTime)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 rounded-xl"
                    onClick={() => router.push(`/events/${order.event.id}`)}
                  >
                    Ver Detalhes
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </AuthenticatedAppShell>
  )
}
