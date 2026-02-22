'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AuthenticatedAppShell } from '@/components/layout/app-shell'
import { Tabs } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { Stat } from '@/components/ui/stat'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Toggle } from '@/components/ui/toggle'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { SkeletonStat, SkeletonCard, SkeletonTextBlock } from '@/components/ui/skeleton'
import { Ticket, Edit2, Check, X, Download, Clock, UserX, FileText, Calendar as CalendarIcon, Mail, MessageSquare, Bell } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { updateProfileSchema, type UpdateProfileFormValues } from '@/lib/validations/profile'
import type { ApiError } from '@/hooks/useApi'
import { cn } from '@/lib/cn'
import { downloadTicketPDF } from '@/lib/pdf/ticket-pdf'
import { formatPhone, stripPhone } from '@/lib/utils/format'

interface User {
  id: string
  name: string
  email: string
  phone?: string
  cpf?: string
}

interface Ticket {
  id: string
  code: string
  type: string
  price: number
  isUsed: boolean
  lot: {
    name: string
  }
  seat?: {
    sector?: {
      name: string
    }
  }
  event: {
    id: string
    title: string
    startTime: string
    location: string
    imageUrl: string
  }
}

interface TicketWalletEvent {
  id: string
  title: string
  startTime: string
  location: string
  imageUrl: string
  ticketCount: number
}

interface WalletTicket {
  id: string
  code: string
  type: string
  price: number
  isUsed: boolean
  lot: {
    name: string
  }
  seat?: {
    sector?: {
      name: string
    }
  }
  event: {
    id: string
    title: string
    startTime: string
    location: string
    imageUrl: string
  }
}

interface WalletData {
  tickets: WalletTicket[]
  events: TicketWalletEvent[]
}

interface WaitlistEntry {
  id: string
  eventId: string
  position: number
  notified: boolean
  createdAt: string
  lot: {
    id: string
    name: string
    price: number
  } | null
  event: {
    id: string
    title: string
    startTime: string
    location: string
    imageUrl: string
    isPublished: boolean
  }
}

interface ProfileData {
  user: User
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
  tickets: Ticket[]
}

interface NotificationPreferences {
  emailNotifications: {
    purchaseConfirmation: boolean
    eventReminder: boolean
    refundStatus: boolean
    marketingEmails: boolean
  }
  smsNotifications: {
    purchaseConfirmation: boolean
    eventReminder: boolean
    refundStatus: boolean
  }
}

export default function AttendeeProfile() {
  const router = useRouter()
  const toast = useToast()
  const [activeSection, setActiveSection] = useState<'profile' | 'orders' | 'wallet' | 'waitlist' | 'notifications'>('profile')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    emailNotifications: {
      purchaseConfirmation: true,
      eventReminder: true,
      refundStatus: true,
      marketingEmails: false
    },
    smsNotifications: {
      purchaseConfirmation: false,
      eventReminder: false,
      refundStatus: false
    }
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<UpdateProfileFormValues>({
    name: '',
    phone: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [qrCodes, setQRCodes] = useState<Record<string, string>>({})
  const [loadingQRCodes, setLoadingQRCodes] = useState<Record<string, boolean>>({})
  const [generatingPDFs, setGeneratingPDFs] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const section = activeSection === 'profile' ? 'profile'
        : activeSection === 'orders' ? 'orders'
        : activeSection === 'wallet' ? 'wallet'
        : activeSection === 'waitlist' ? 'waitlist'
        : 'notifications'

      const response = await fetch(`/api/profile?section=${section}`)
      const data = await response.json()

      if (response.ok) {
        if (activeSection === 'profile') {
          setProfile(data.profile)
        } else if (activeSection === 'orders') {
          setOrders(data.orders)
        } else if (activeSection === 'wallet') {
          setWallet(data.wallet)
        } else if (activeSection === 'waitlist') {
          setWaitlist(data.waitlist)
        }
        // Note: For notifications, we use localStorage for now since backend API is not yet available
        // This is frontend-only implementation per VISION.md constraint
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar dados',
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
  }, [activeSection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Load notification preferences from localStorage on mount
  useEffect(() => {
    const storedPrefs = localStorage.getItem('notificationPreferences')
    if (storedPrefs) {
      try {
        const parsed = JSON.parse(storedPrefs)
        setNotificationPrefs(parsed)
      } catch (e) {
        console.error('Failed to parse notification preferences', e)
      }
    }
  }, [])

  const handleNotificationChange = (
    category: 'emailNotifications' | 'smsNotifications',
    key: string,
    value: boolean
  ) => {
    setNotificationPrefs(prev => {
      const newPrefs = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      }
      // Save to localStorage
      localStorage.setItem('notificationPreferences', JSON.stringify(newPrefs))
      return newPrefs
    })
  }

  const handleSaveNotificationPrefs = async () => {
    try {
      setSavingPrefs(true)
      // TODO: When backend API is available, send preferences to server
      // For now, they're saved to localStorage
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate save
      toast.success('Preferências de notificação salvas com sucesso!')
    } catch (err) {
      toast.error('Erro ao salvar preferências de notificação')
    } finally {
      setSavingPrefs(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
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

  // Format date for iCalendar format (YYYYMMDDTHHmmssZ)
  const formatICalDate = (dateString: string | Date) => {
    const date = new Date(dateString)
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  // Generate Google Calendar link for a ticket
  const getGoogleCalendarLink = (ticket: WalletTicket) => {
    const startDate = new Date(ticket.event.startTime)
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000) // Default 2 hours

    const title = encodeURIComponent(ticket.event.title || 'Evento')
    const details = encodeURIComponent(
      `Ingresso: ${ticket.code}\\n` +
      `Tipo: ${ticket.type} - ${ticket.lot.name}\\n` +
      (ticket.event.location ? `Local: ${ticket.event.location}\\n` : '')
    )
    const location = encodeURIComponent(ticket.event.location || 'Evento online')
    const dates = `${formatICalDate(startDate)}/${formatICalDate(endDate)}`

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`
  }

  // Generate .ics file content for a ticket
  const generateICSContent = (ticket: WalletTicket) => {
    const startDate = new Date(ticket.event.startTime)
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000) // Default 2 hours

    const now = new Date()
    const uid = `${ticket.code}@bileto.sympla`

    const location = ticket.event.location || 'Evento online'

    const description =
      `Ingresso: ${ticket.code}\\n` +
      `Tipo: ${ticket.type} - ${ticket.lot.name}\\n` +
      `Local: ${location}\\n`

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bileto Sympla//Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatICalDate(now)}`,
      `DTSTART:${formatICalDate(startDate)}`,
      `DTEND:${formatICalDate(endDate)}`,
      `SUMMARY:${ticket.event.title || 'Evento'}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
  }

  // Download .ics file for a ticket
  const handleDownloadICS = (ticket: WalletTicket) => {
    const icsContent = generateICSContent(ticket)
    if (!icsContent) return

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `evento-${ticket.code}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const handleEditClick = () => {
    if (!profile) return
    setEditForm({
      name: profile.user.name,
      phone: profile.user.phone || ''
    })
    setFormErrors({})
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({ name: '', phone: '' })
    setFormErrors({})
  }

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true)
      setFormErrors({})

      // Validate form
      const result = updateProfileSchema.safeParse(editForm)
      if (!result.success) {
        const errors: Record<string, string> = {}
        result.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0].toString()] = issue.message
          }
        })
        setFormErrors(errors)
        return
      }

      // Strip phone formatting for API (backend expects digits only)
      const dataToSend = {
        ...editForm,
        phone: editForm.phone ? stripPhone(editForm.phone) : undefined
      }

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Perfil atualizado com sucesso!')
        setIsEditing(false)
        // Refresh profile data
        fetchData()
      } else {
        toast.error(data.error || 'Erro ao atualizar perfil')
      }
    } catch (err) {
      toast.error('Erro ao atualizar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFormFieldChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value)
    handleFormFieldChange('phone', formatted)
  }

  const fetchQRCode = async (ticketId: string) => {
    if (qrCodes[ticketId]) {
      return qrCodes[ticketId]
    }

    setLoadingQRCodes(prev => ({ ...prev, [ticketId]: true }))

    try {
      const response = await fetch(`/api/tickets/${ticketId}/qrcode`)
      const data = await response.json()

      if (response.ok && data.qrCode) {
        setQRCodes(prev => ({ ...prev, [ticketId]: data.qrCode }))
        return data.qrCode
      } else {
        toast.error(data.error || 'Erro ao carregar QR Code')
        return null
      }
    } catch (error) {
      toast.error('Erro de conexão ao carregar QR Code')
      return null
    } finally {
      setLoadingQRCodes(prev => ({ ...prev, [ticketId]: false }))
    }
  }

  const handleDownloadQRCode = (ticketId: string, ticketCode: string) => {
    const qrCode = qrCodes[ticketId]
    if (!qrCode) return

    const link = document.createElement('a')
    link.href = qrCode
    link.download = `qr-code-${ticketCode}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDownloadPDF = async (ticket: WalletTicket) => {
    const qrCode = qrCodes[ticket.id]
    if (!qrCode) {
      toast.error('Carregue o QR Code primeiro')
      return
    }

    setGeneratingPDFs(prev => ({ ...prev, [ticket.id]: true }))

    try {
      await downloadTicketPDF(
        {
          ticketCode: ticket.code,
          ticketType: ticket.type,
          lotName: ticket.lot.name,
          price: ticket.price,
          qrCodeDataUrl: qrCode,
          isUsed: ticket.isUsed,
        },
        ticket.event,
        {
          id: ticket.event.id, // Using event.id as fallback for order.id
          createdAt: new Date().toISOString(),
        }
      )
      toast.success('PDF do ingresso baixado com sucesso!')
    } catch (error) {
      toast.error('Erro ao gerar PDF do ingresso. Tente novamente.')
    } finally {
      setGeneratingPDFs(prev => ({ ...prev, [ticket.id]: false }))
    }
  }

  const handleLeaveWaitlist = async (entryId: string, eventId: string, lotId: string | null) => {
    if (!confirm('Tem certeza que deseja sair da lista de espera?')) {
      return
    }

    try {
      const response = await fetch('/api/waitlist/leave', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventId, lotId })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Você saiu da lista de espera')
        // Refresh waitlist data
        fetchData()
      } else {
        toast.error(data.error || 'Erro ao sair da lista de espera')
      }
    } catch (err) {
      toast.error('Erro ao sair da lista de espera')
    }
  }

  if (loading) {
    return (
      <AuthenticatedAppShell>
        <main className="space-y-8" aria-live="polite" aria-busy="true">
          {/* Page Header Skeleton */}
          <div>
            <div className="h-10 bg-neutral-200 rounded animate-pulse w-48 mb-4" />
            <div className="h-6 bg-neutral-200 rounded animate-pulse w-64" />
          </div>

          {/* Tabs Skeleton */}
          <div className="border-b border-neutral-200">
            <div className="flex gap-8">
              <div className="h-10 bg-neutral-200 rounded-t animate-pulse w-24" />
              <div className="h-10 bg-neutral-200 rounded-t animate-pulse w-24" />
              <div className="h-10 bg-neutral-200 rounded-t animate-pulse w-24" />
            </div>
          </div>

          {/* Profile Info Skeleton */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <SkeletonTextBlock lines={4} />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonStat />
            <SkeletonStat />
            <SkeletonStat />
          </div>

          {/* Orders/Waitlist Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </AuthenticatedAppShell>
    )
  }

  return (
    <AuthenticatedAppShell>
      <main className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900">Meu Perfil</h1>
        </div>

        {error && (
          <ErrorState
            title="Erro ao Carregar Dados"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchData()}
          />
        )}

        <Tabs
          tabs={[
            { id: 'profile', label: 'Perfil' },
            { id: 'orders', label: 'Pedidos' },
            { id: 'wallet', label: 'Carteira de Ingressos' },
            { id: 'waitlist', label: 'Lista de Espera' },
            { id: 'notifications', label: 'Notificações' }
          ]}
          activeTab={activeSection}
          onChange={(tab) => setActiveSection(tab as any)}
        />

        {activeSection === 'profile' && profile && (
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-display font-semibold text-neutral-900">
                Meus Dados
              </h2>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="w-[1rem] h-[1rem]" />
                  Editar
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <FormField
                  name="name"
                  label="Nome"
                  placeholder="Seu nome completo"
                  value={editForm.name}
                  onChange={(value) => handleFormFieldChange('name', value)}
                  error={formErrors.name}
                  schema={updateProfileSchema.shape.name}
                  validateOnChange={true}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email
                  </label>
                  <div className="text-neutral-900">{profile.user.email}</div>
                  <p className="text-xs text-neutral-600 mt-1">Email não pode ser alterado</p>
                </div>

                <FormField
                  name="phone"
                  label="Telefone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={editForm.phone}
                  onChange={handlePhoneChange}
                  error={formErrors.phone}
                  schema={updateProfileSchema.shape.phone}
                  validateOnChange={true}
                  helperText="Formato: (11) 99999-9999"
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    CPF
                  </label>
                  <div className="text-neutral-900">{profile.user.cpf || 'Não informado'}</div>
                  <p className="text-xs text-neutral-600 mt-1">CPF não pode ser alterado</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="primary"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>Salvando...</>
                    ) : (
                      <>
                        <Check className="w-[1rem] h-[1rem]" />
                        Salvar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-2"
                  >
                    <X className="w-[1rem] h-[1rem]" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Nome
                  </label>
                  <div className="text-neutral-900">{profile.user.name}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email
                  </label>
                  <div className="text-neutral-900">{profile.user.email}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Telefone
                  </label>
                  <div className="text-neutral-900">{profile.user.phone || 'Não informado'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    CPF
                  </label>
                  <div className="text-neutral-900">{profile.user.cpf || 'Não informado'}</div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-neutral-200">
              <h3 className="text-md font-display font-semibold text-neutral-900 mb-4">
                Estatísticas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat
                  label="Total de Pedidos"
                  value={profile.stats.totalOrders}
                  className="bg-primary-50"
                />
                <Stat
                  label="Total de Ingressos"
                  value={profile.stats.totalTickets}
                  className="bg-success-50"
                />
                <Stat
                  label="Ingressos Utilizados"
                  value={profile.stats.usedTickets}
                  className="bg-secondary-50"
                />
                <Stat
                  label="Eventos Futuros"
                  value={profile.stats.upcomingEvents}
                  className="bg-warning-50"
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'orders' && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-semibold text-neutral-900 mb-4">
              Histórico de Pedidos
            </h2>

            {orders.length === 0 ? (
              <EmptyState
                icon={<Ticket className="w-16 h-16" />}
                title="Nenhum pedido encontrado"
                description="Você ainda não fez nenhum pedido."
              />
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl shadow-card p-4"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        {order.event.imageUrl && (
                          <Image
                            src={order.event.imageUrl}
                            alt={order.event.title}
                            width={80}
                            height={80}
                            className="w-20 h-20 object-cover rounded-xl"
                          />
                        )}
                        <div>
                          <div className="font-display font-semibold text-neutral-900">
                            {order.event.title}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {formatDate(order.event.startTime)}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {order.tickets.length} ingresso(s)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-display font-bold text-success-600">
                          {formatCurrency(order.totalAmount)}
                        </div>
                        <div
                          className={cn(
                            "text-sm px-3 py-1 rounded-xl",
                            order.paymentStatus === 'APPROVED'
                              ? 'bg-success-100 text-success-700'
                              : order.paymentStatus === 'PENDING'
                              ? 'bg-warning-100 text-warning-700'
                              : 'bg-error-100 text-error-700'
                          )}
                        >
                          {order.paymentStatus === 'APPROVED' && 'Aprovado'}
                          {order.paymentStatus === 'PENDING' && 'Pendente'}
                          {order.paymentStatus === 'REFUSED' && 'Recusado'}
                          {order.paymentStatus === 'REFUNDED' && 'Reembolsado'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'wallet' && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-semibold text-neutral-900 mb-4">
              Minha Carteira de Ingressos
            </h2>

            {!wallet || wallet.tickets.length === 0 ? (
              <EmptyState
                icon={<Ticket className="w-16 h-16" />}
                title="Nenhum ingresso encontrado"
                description="Você ainda não possui ingressos na sua carteira."
              />
            ) : (
              <div className="space-y-4">
                {wallet.tickets.map(ticket => (
                  <article
                    key={ticket.id}
                    className="bg-white rounded-2xl shadow-card overflow-hidden"
                  >
                    {/* Event Header */}
                    <div className="bg-neutral-50 px-4 py-4 border-b border-neutral-200">
                      <div className="flex items-start gap-4">
                        {ticket.event.imageUrl && (
                          <Image
                            src={ticket.event.imageUrl}
                            alt={ticket.event.title}
                            width={60}
                            height={60}
                            className="w-16 h-16 object-cover rounded-xl"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-neutral-900 truncate">
                            {ticket.event.title}
                          </h3>
                          <div className="text-sm text-neutral-600">
                            {formatDate(ticket.event.startTime)}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {ticket.event.location || 'Evento online'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Add to Calendar buttons */}
                    <div className="px-4 py-4 bg-neutral-50 border-b border-neutral-200">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                          <CalendarIcon className="w-[1rem] h-[1rem] text-primary-500" aria-hidden="true" />
                          Adicionar ao Calendário
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getGoogleCalendarLink(ticket), '_blank', 'noopener,noreferrer')}
                          aria-label="Adicionar ao Google Calendar"
                        >
                          <CalendarIcon className="w-[1rem] h-[1rem] mr-1" />
                          Google
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadICS(ticket)}
                          aria-label="Baixar arquivo .ics para Apple Calendar ou Outlook"
                        >
                          <Download className="w-[1rem] h-[1rem] mr-1" />
                          .ics
                        </Button>
                      </div>
                    </div>

                    {/* Ticket Details */}
                    <div className="p-4 space-y-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="font-medium text-neutral-900 mb-1">
                            {ticket.type} - {ticket.lot.name}
                          </div>
                          <div className="text-sm text-neutral-600 mb-2">
                            Código: {ticket.code}
                          </div>
                          <div className="text-sm">
                            <span className={cn(
                              "font-medium",
                              ticket.isUsed ? 'text-success-600' : 'text-neutral-900'
                            )}>
                              {formatCurrency(ticket.price)}
                            </span>
                            <span className={cn(
                              "mx-2",
                              ticket.isUsed ? 'text-success-600' : 'text-neutral-600'
                            )}>
                              •
                            </span>
                            <span className={ticket.isUsed ? 'text-success-600' : 'text-neutral-600'}>
                              {ticket.isUsed ? 'Utilizado' : 'Não utilizado'}
                            </span>
                          </div>
                          {ticket.seat?.sector && (
                            <div className="text-sm text-neutral-600 mt-1">
                              Setor: {ticket.seat.sector.name}
                            </div>
                          )}
                        </div>
                        {!ticket.isUsed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchQRCode(ticket.id)}
                            disabled={loadingQRCodes[ticket.id]}
                            loading={loadingQRCodes[ticket.id]}
                          >
                            {qrCodes[ticket.id] ? 'Atualizar QR Code' : 'Ver QR Code'}
                          </Button>
                        )}
                      </div>

                      {/* QR Code Display */}
                      {!ticket.isUsed && qrCodes[ticket.id] && (
                        <div className="border-t border-neutral-200 pt-4" aria-live="polite">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-neutral-900">
                              QR Code para Check-in
                            </h4>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadPDF(ticket)}
                                disabled={generatingPDFs[ticket.id]}
                                loading={generatingPDFs[ticket.id]}
                                className="text-primary-600 hover:text-primary-700"
                                aria-label="Baixar ingresso como PDF"
                              >
                                <FileText className="w-[1rem] h-[1rem] mr-1" />
                                PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownloadQRCode(ticket.id, ticket.code)}
                                className="text-primary-600 hover:text-primary-700"
                                aria-label="Baixar QR Code como imagem"
                              >
                                <Download className="w-[1rem] h-[1rem] mr-1" />
                                Imagem
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-center bg-white p-4 rounded-xl border border-neutral-200">
                            <Image
                              src={qrCodes[ticket.id]}
                              alt={`QR Code para ingresso ${ticket.code}`}
                              width={200}
                              height={200}
                              className="w-48 h-48"
                            />
                          </div>
                          <p className="text-xs text-neutral-600 mt-2 text-center">
                            Apresente este QR Code no local do evento para check-in
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'waitlist' && (
          <div className="space-y-4">
            <h2 className="text-lg font-display font-semibold text-neutral-900 mb-4">
              Minha Lista de Espera
            </h2>

            {waitlist.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-16 h-16" />}
                title="Nenhuma lista de espera"
                description="Você não está em nenhuma lista de espera no momento."
              />
            ) : (
              <div className="space-y-4">
                {waitlist.map(entry => (
                  <article
                    key={entry.id}
                    className="bg-white rounded-2xl shadow-card overflow-hidden"
                  >
                    {/* Event Header */}
                    <div className="bg-neutral-50 px-4 py-4 border-b border-neutral-200">
                      <div className="flex items-start gap-4">
                        {entry.event.imageUrl && (
                          <Image
                            src={entry.event.imageUrl}
                            alt={entry.event.title}
                            width={60}
                            height={60}
                            className="w-16 h-16 object-cover rounded-xl"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-neutral-900 truncate">
                            {entry.event.title}
                          </h3>
                          <div className="text-sm text-neutral-600">
                            {formatDate(entry.event.startTime)}
                          </div>
                          <div className="text-sm text-neutral-600">
                            {entry.event.location || 'Evento online'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Waitlist Details */}
                    <div className="p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {entry.lot && (
                            <div className="font-medium text-neutral-900 mb-1">
                              Lote: {entry.lot.name}
                            </div>
                          )}
                          <div className="text-sm text-neutral-600 mb-2">
                            Posição na fila: <span className="font-semibold text-primary-600">#{entry.position}</span>
                          </div>
                          <div className="text-sm">
                            <span className={cn(
                              "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium",
                              entry.notified
                                ? 'bg-success-100 text-success-700'
                                : 'bg-neutral-100 text-neutral-700'
                            )}>
                              {entry.notified ? 'Você foi notificado!' : 'Aguardando notificação'}
                            </span>
                          </div>
                          {entry.notified && (
                            <div className="text-sm text-success-600 mt-2">
                              Ingressos disponíveis! Corra para comprar.
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleLeaveWaitlist(entry.id, entry.eventId, entry.lot?.id || null)}
                          className="flex items-center gap-2"
                        >
                          <UserX className="w-[1rem] h-[1rem]" />
                          Sair da Lista
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-display font-semibold text-neutral-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary-600" aria-hidden="true" />
                    Preferências de Notificação
                  </h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    Escolha como e quando deseja receber notificações
                  </p>
                </div>
              </div>

              {/* Email Notifications Section */}
              <section className="mb-8" aria-labelledby="email-notifications-heading">
                <h3 id="email-notifications-heading" className="text-md font-display font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary-600" aria-hidden="true" />
                  Notificações por E-mail
                </h3>
                <div className="space-y-4">
                  <Toggle
                    label="Confirmação de Compra"
                    description="Receba confirmação quando comprar ingressos"
                    checked={notificationPrefs.emailNotifications.purchaseConfirmation}
                    onChange={(checked) => handleNotificationChange('emailNotifications', 'purchaseConfirmation', checked)}
                    aria-label="Toggle email notifications for purchase confirmation"
                  />
                  <Toggle
                    label="Lembrete de Evento"
                    description="Receba lembrete 24h antes do evento"
                    checked={notificationPrefs.emailNotifications.eventReminder}
                    onChange={(checked) => handleNotificationChange('emailNotifications', 'eventReminder', checked)}
                    aria-label="Toggle email notifications for event reminder"
                  />
                  <Toggle
                    label="Status de Reembolso"
                    description="Receba atualizações sobre solicitações de reembolso"
                    checked={notificationPrefs.emailNotifications.refundStatus}
                    onChange={(checked) => handleNotificationChange('emailNotifications', 'refundStatus', checked)}
                    aria-label="Toggle email notifications for refund status"
                  />
                  <Toggle
                    label="E-mails de Marketing"
                    description="Receba novidades e promoções de eventos"
                    checked={notificationPrefs.emailNotifications.marketingEmails}
                    onChange={(checked) => handleNotificationChange('emailNotifications', 'marketingEmails', checked)}
                    aria-label="Toggle marketing email notifications"
                  />
                </div>
              </section>

              <hr className="border-neutral-200 my-8" />

              {/* SMS Notifications Section */}
              <section aria-labelledby="sms-notifications-heading">
                <h3 id="sms-notifications-heading" className="text-md font-display font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary-600" aria-hidden="true" />
                  Notificações por SMS
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Mensagens de texto podem ser enviadas para o seu telefone cadastrado. Tarifas de seu operador podem aplicar.
                </p>
                <div className="space-y-4">
                  <Toggle
                    label="Confirmação de Compra"
                    description="Receba SMS de confirmação após comprar ingressos"
                    checked={notificationPrefs.smsNotifications.purchaseConfirmation}
                    onChange={(checked) => handleNotificationChange('smsNotifications', 'purchaseConfirmation', checked)}
                    aria-label="Toggle SMS notifications for purchase confirmation"
                  />
                  <Toggle
                    label="Lembrete de Evento"
                    description="Receba SMS de lembrete 2h antes do evento"
                    checked={notificationPrefs.smsNotifications.eventReminder}
                    onChange={(checked) => handleNotificationChange('smsNotifications', 'eventReminder', checked)}
                    aria-label="Toggle SMS notifications for event reminder"
                  />
                  <Toggle
                    label="Status de Reembolso"
                    description="Receba SMS sobre status de reembolsos"
                    checked={notificationPrefs.smsNotifications.refundStatus}
                    onChange={(checked) => handleNotificationChange('smsNotifications', 'refundStatus', checked)}
                    aria-label="Toggle SMS notifications for refund status"
                  />
                </div>
              </section>

              {/* Save Button */}
              <div className="mt-8 pt-6 border-t border-neutral-200">
                <Button
                  variant="primary"
                  onClick={handleSaveNotificationPrefs}
                  disabled={savingPrefs}
                  className="flex items-center gap-2"
                >
                  {savingPrefs ? (
                    <>Salvando...</>
                  ) : (
                    <>
                      <Check className="w-[1rem] h-[1rem]" />
                      Salvar Preferências
                    </>
                  )}
                </Button>
                <p className="text-xs text-neutral-600 mt-3">
                  Nota: As preferências são salvas localmente. O envio real de notificações será implementado em futuras atualizações.
                </p>
              </div>
            </div>

            {/* Unsubscribe Info Card */}
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-6">
              <h3 className="text-md font-display font-semibold text-neutral-900 mb-2">
                Cancelar Inscrição
              </h3>
              <p className="text-sm text-neutral-600 mb-4">
                Você pode cancelar o recebimento de e-mails de marketing a qualquer momento nas preferências acima. E-mails transacionais (confirmação de compra, lembretes de evento) não podem ser completamente desativados, pois são essenciais para o funcionamento do serviço.
              </p>
              <p className="text-xs text-neutral-500">
                Em conformidade com a LGPD (Lei Geral de Proteção de Dados) e CAN-SPAM Act.
              </p>
            </div>
          </div>
        )}
      </main>
    </AuthenticatedAppShell>
  )
}
