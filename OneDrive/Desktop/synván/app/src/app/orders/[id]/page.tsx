'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuthenticatedAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { AlertTriangle, CheckCircle, Download, Info, DollarSign, Calendar as CalendarIcon, Copy, QrCode, FileText } from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/hooks/useToast'
import type { ApiError } from '@/hooks/useApi'
import { cn } from '@/lib/cn'
import { downloadTicketPDF } from '@/lib/pdf/ticket-pdf'
import { formatCurrency } from '@/lib/utils/format'

interface TicketQRCode {
  ticketId: string
  qrCode: string
}

interface ResaleValidation {
  valid: boolean
  reason?: string
  originalPrice?: number
  maxResalePrice?: number
  eventTitle?: string
  eventDate?: Date
}

export default function OrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [requestingRefund, setRequestingRefund] = useState(false)
  const [qrCodes, setQRCodes] = useState<Record<string, string>>({})
  const [loadingQRCodes, setLoadingQRCodes] = useState<Record<string, boolean>>({})

  // Resale modal state
  const [resaleModalOpen, setResaleModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [resalePrice, setResalePrice] = useState('')
  const [resalePriceError, setResalePriceError] = useState('')
  const [validatingResale, setValidatingResale] = useState(false)
  const [submittingResale, setSubmittingResale] = useState(false)
  const [resaleValidation, setResaleValidation] = useState<ResaleValidation | null>(null)

  // Pix QR code modal state
  const [pixModalOpen, setPixModalOpen] = useState(false)
  const [copiedPixCode, setCopiedPixCode] = useState(false)

  // PDF download state
  const [generatingPDFs, setGeneratingPDFs] = useState<Record<string, boolean>>({})

  const fetchOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setOrder(data.order)
        setError(null)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar pedido',
          status: response.status,
          code: data.code
        }
        setError(apiError)
      }
    } catch (error) {
      const apiError: ApiError = {
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        status: undefined
      }
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchOrder()
  }, [params.id, fetchOrder])

  const handleRefundRequest = async () => {
    if (!confirm('Tem certeza que deseja solicitar o reembolso? Esta ação não pode ser desfeita.')) {
      return
    }

    setRequestingRefund(true)

    try {
      const response = await fetch(`/api/orders/${params.id}/refund`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        const refundAmount = formatCurrency(data.refundAmount || 0)
        toast.success(`Solicitação de reembolso enviada com sucesso! Valor: ${refundAmount}`)
        await fetchOrder()
      } else {
        toast.error(data.error || 'Erro ao solicitar reembolso')
      }
    } catch (error) {
      toast.error('Erro ao solicitar reembolso. Tente novamente.')
    } finally {
      setRequestingRefund(false)
    }
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

  const handleDownloadPDF = async (ticket: any) => {
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
        order.event,
        {
          id: order.id,
          createdAt: order.createdAt,
        }
      )
      toast.success('PDF do ingresso baixado com sucesso!')
    } catch (error) {
      toast.error('Erro ao gerar PDF do ingresso. Tente novamente.')
    } finally {
      setGeneratingPDFs(prev => ({ ...prev, [ticket.id]: false }))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  // Format date for iCalendar format (YYYYMMDDTHHmmssZ)
  const formatICalDate = (dateString: string | Date) => {
    const date = new Date(dateString)
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  // Generate Google Calendar link
  const getGoogleCalendarLink = (order: any) => {
    if (!order.event) return ''

    const startDate = new Date(order.event.startTime)
    const endDate = order.event.endTime
      ? new Date(order.event.endTime)
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000) // Default 2 hours

    const title = encodeURIComponent(order.event.title || 'Evento')
    const details = encodeURIComponent(
      `Pedido: #${order.id}\n` +
      `Ingressos: ${order.tickets.length}\n` +
      (order.event.location ? `Local: ${order.event.location}\n` : '') +
      (order.event.address ? `Endereço: ${order.event.address}\n` : '')
    )
    const location = encodeURIComponent(
      [order.event.location, order.event.address, order.event.city, order.event.state]
        .filter(Boolean).join(', ')
    )
    const dates = `${formatICalDate(startDate)}/${formatICalDate(endDate)}`

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`
  }

  // Generate .ics file content
  const generateICSContent = (order: any) => {
    if (!order.event) return ''

    const startDate = new Date(order.event.startTime)
    const endDate = order.event.endTime
      ? new Date(order.event.endTime)
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000)

    const now = new Date()
    const uid = `${order.id}@bileto.sympla`

    const location = [order.event.location, order.event.address, order.event.city, order.event.state]
      .filter(Boolean).join(', ')

    const description =
      `Pedido: #${order.id}\\n` +
      `Ingressos: ${order.tickets.length}\\n` +
      (location ? `Local: ${location}\\n` : '')

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
      `SUMMARY:${order.event.title || 'Evento'}`,
      `DESCRIPTION:${description}`,
      location ? `LOCATION:${location}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n')
  }

  // Download .ics file
  const handleDownloadICS = (order: any) => {
    const icsContent = generateICSContent(order)
    if (!icsContent) return

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `evento-${order.id}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const calculateDiscount = (order: any) => {
    if (!order.promocode) return 0

    // Calculate subtotal from ticket prices
    const subtotal = order.tickets.reduce((sum: number, ticket: any) => sum + ticket.price, 0)

    // Calculate discount based on promocode type
    let discount = 0
    if (order.promocode.discountType === 'PERCENTAGE') {
      discount = subtotal * (order.promocode.discountValue / 100)
    } else {
      discount = order.promocode.discountValue
    }

    // Discount cannot exceed subtotal
    return Math.min(discount, subtotal)
  }

  const handleOpenResaleModal = async (ticket: any) => {
    setSelectedTicket(ticket)
    setResalePrice('')
    setResalePriceError('')
    setResaleValidation(null)
    setResaleModalOpen(true)

    // Validate ticket for resale
    setValidatingResale(true)
    try {
      const response = await fetch('/api/resale/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id }),
      })

      const data = await response.json()
      if (response.ok) {
        setResaleValidation(data)
        if (data.valid && data.originalPrice) {
          // Pre-fill with original price
          setResalePrice(data.originalPrice.toString())
        }
      } else {
        toast.error(data.error || 'Erro ao validar ingresso para revenda')
        setResaleModalOpen(false)
      }
    } catch (error) {
      toast.error('Erro ao validar ingresso. Tente novamente.')
      setResaleModalOpen(false)
    } finally {
      setValidatingResale(false)
    }
  }

  const handleCloseResaleModal = () => {
    setResaleModalOpen(false)
    setSelectedTicket(null)
    setResalePrice('')
    setResalePriceError('')
    setResaleValidation(null)
  }

  const validateResalePrice = (): boolean => {
    const price = parseFloat(resalePrice)
    const maxPrice = resaleValidation?.maxResalePrice || 0

    if (!resalePrice || isNaN(price)) {
      setResalePriceError('Preço de revenda é obrigatório')
      return false
    }

    if (price <= 0) {
      setResalePriceError('Preço deve ser maior que zero')
      return false
    }

    if (maxPrice > 0 && price > maxPrice) {
      setResalePriceError(`Preço não pode exceder R$ ${maxPrice.toFixed(2)}`)
      return false
    }

    setResalePriceError('')
    return true
  }

  const handleSubmitResale = async () => {
    if (!selectedTicket || !resaleValidation?.valid) return

    if (!validateResalePrice()) {
      return
    }

    const price = parseFloat(resalePrice)
    setSubmittingResale(true)
    try {
      const response = await fetch('/api/resale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          resalePrice: price,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast.success('Ingresso listado para revenda com sucesso!')
        handleCloseResaleModal()
        await fetchOrder()
      } else {
        toast.error(data.error || 'Erro ao listar ingresso para revenda')
      }
    } catch (error) {
      toast.error('Erro ao listar ingresso. Tente novamente.')
    } finally {
      setSubmittingResale(false)
    }
  }

  // Generate Pix QR Code (simulated for frontend-only phase)
  const generatePixPayload = (order: any): string => {
    // This is a simulated Pix payload format
    // In production, this would come from the payment gateway
    const amount = order.totalAmount.toFixed(2)
    const orderId = order.id
    return `00020126580014BR.GOV.BCB.PIX0136${orderId}5204000053039865404${amount}5802BR5925SIMPLAO EVENTOS LTDA6009SAO PAULO62070503***6304`
  }

  const handleCopyPixCode = (pixCode: string) => {
    navigator.clipboard.writeText(pixCode).then(() => {
      setCopiedPixCode(true)
      toast.success('Código Pix copiado!')
      setTimeout(() => setCopiedPixCode(false), 3000)
    }).catch(() => {
      toast.error('Erro ao copiar código')
    })
  }

  const handleDownloadBoleto = (orderId: string) => {
    // In production, this would download the actual boleto PDF from payment gateway
    // For now, show a toast with instructions
    toast.info('O boleto será enviado para o seu e-mail cadastrado.')
  }

  if (loading) {
    return (
      <AuthenticatedAppShell>
        <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span className="sr-only">Carregando pedido...</span>
        </div>
      </AuthenticatedAppShell>
    )
  }

  if (error) {
    return (
      <AuthenticatedAppShell>
        <ErrorState
          title="Erro ao Carregar Pedido"
          message={getErrorMessageFromError(error)}
          variant={getErrorVariantFromStatus(error.status)}
          onRetry={() => fetchOrder()}
          onGoBack={() => router.push('/orders')}
        />
      </AuthenticatedAppShell>
    )
  }

  if (!order) {
    return (
      <AuthenticatedAppShell>
        <div className="flex items-center justify-center h-64">
          <div className="bg-white rounded-2xl shadow-card p-8 text-center">
            <h1 className="text-2xl font-display font-bold text-neutral-900 mb-4">Pedido não encontrado</h1>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="primary"
            >
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </AuthenticatedAppShell>
    )
  }

  const canRequestRefund =
    order.paymentStatus === 'APPROVED' &&
    !order.refundRequested &&
    !order.tickets.some((t: any) => t.isUsed)

  const isWithin7Days = Math.abs(Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 7
  const isMoreThan48hBeforeEvent = new Date(order.event.startTime).getTime() - Date.now() > 48 * 60 * 60 * 1000

  return (
    <AuthenticatedAppShell>
      <main className="space-y-6">
        <PageHeader
          title="Detalhes do Pedido"
          subtitle={`Pedido #${order.id}`}
          breadcrumbs={[
            { label: 'Meus Pedidos', href: '/orders' },
            { label: `Pedido #${order.id}` },
          ]}
          actions={
            <Badge
              variant={
                order.paymentStatus === 'APPROVED' ? 'success' :
                order.paymentStatus === 'PENDING' ? 'warning' :
                order.paymentStatus === 'REFUNDED' ? 'info' :
                'error'
              }
              size="md"
            >
              {order.paymentStatus === 'APPROVED' ? 'Aprovado' :
               order.paymentStatus === 'PENDING' ? 'Pendente' :
               order.paymentStatus === 'REFUNDED' ? 'Reembolsado' :
               'Recusado'}
            </Badge>
          }
        />

        <div className="bg-white rounded-2xl shadow-card p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-display font-semibold text-neutral-900 mb-3">Informações do Evento</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-600">Evento:</span>
                  <span className="ml-2 text-neutral-900">{order.event.title}</span>
                </div>
                <div>
                  <span className="text-neutral-600">Data:</span>
                  <span className="ml-2 text-neutral-900">{formatDate(order.event.startTime)}</span>
                </div>
                {order.event.location && (
                  <div>
                    <span className="text-neutral-600">Local:</span>
                    <span className="ml-2 text-neutral-900">{order.event.location}</span>
                  </div>
                )}
              </div>

              {/* Add to Calendar buttons */}
              <div className="mt-8 pt-8 border-t border-neutral-200">
                <h3 className="text-base font-medium text-neutral-700 mb-4 flex items-center gap-4">
                  <CalendarIcon className="w-5 h-5 text-primary-500" aria-hidden="true" />
                  Adicionar ao Calendário
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => window.open(getGoogleCalendarLink(order), '_blank', 'noopener,noreferrer')}
                    aria-label="Adicionar ao Google Calendar"
                  >
                    <CalendarIcon className="w-[1rem] h-[1rem]" aria-hidden="true" />
                    Google Calendar
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => handleDownloadICS(order)}
                    aria-label="Baixar arquivo .ics para Apple Calendar ou Outlook"
                  >
                    <Download className="w-[1rem] h-[1rem]" aria-hidden="true" />
                    Baixar (.ics)
                  </Button>
                </div>
                <p className="text-sm text-neutral-600 mt-4">
                  Compatível com Apple Calendar, Outlook, e outros aplicativos de calendário
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-display font-semibold text-neutral-900 mb-3">Informações do Pedido</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-neutral-600">ID do Pedido:</span>
                  <span className="ml-2 text-neutral-900">{order.id}</span>
                </div>
                <div>
                  <span className="text-neutral-600">Data do Pedido:</span>
                  <span className="ml-2 text-neutral-900">{formatDate(order.createdAt)}</span>
                </div>
                <div>
                  <span className="text-neutral-600">Método de Pagamento:</span>
                  <span className="ml-2 text-neutral-900">{order.paymentMethod}</span>
                </div>
                {order.refundDate && (
                  <div>
                    <span className="text-neutral-600">Data do Reembolso:</span>
                    <span className="ml-2 text-neutral-900">{formatDate(order.refundDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pix Payment Instructions */}
        {order.paymentStatus === 'PENDING' && order.paymentMethod === 'PIX' && (
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-success-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-display font-semibold text-neutral-900 mb-8">
                  Aguardando Pagamento via Pix
                </h3>
                <div className="space-y-4 text-sm text-neutral-600">
                  <p>
                    1. Abra o aplicativo do seu banco ou carteira digital
                  </p>
                  <p>
                    2. Escolha a opção &ldquo;Pagar com Pix QR Code&rdquo; ou &ldquo;Copiar e Colar&rdquo;
                  </p>
                  <p>
                    3. Escaneie o QR Code ou cole o código abaixo
                  </p>
                  <p>
                    <strong className="text-neutral-900">Valor a pagar: {formatCurrency(order.totalAmount)}</strong>
                  </p>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="primary"
                    onClick={() => setPixModalOpen(true)}
                    className="flex-1 sm:flex-none"
                  >
                    <QrCode className="w-[1rem] h-[1rem] mr-2" />
                    Ver QR Code Pix
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyPixCode(generatePixPayload(order))}
                    className="flex-1 sm:flex-none"
                  >
                    <Copy className="w-[1rem] h-[1rem] mr-2" />
                    {copiedPixCode ? 'Copiado!' : 'Copiar Código'}
                  </Button>
                </div>

                <div className="mt-8 p-4 bg-warning-50 border border-warning-200 rounded-xl">
                  <p className="text-sm text-warning-800">
                    <strong>Atenção:</strong> O pagamento pode levar até 30 minutos para ser confirmado.
                    Você receberá uma notificação por e-mail quando o pagamento for aprovado.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Boleto Payment Instructions */}
        {order.paymentStatus === 'PENDING' && order.paymentMethod === 'BOLETO' && (
          <div className="bg-white rounded-2xl shadow-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-neutral-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-display font-semibold text-neutral-900 mb-8">
                  Aguardando Pagamento via Boleto
                </h3>
                <div className="space-y-4 text-sm text-neutral-600">
                  <p>
                    1. O boleto foi enviado para o seu e-mail cadastrado
                  </p>
                  <p>
                    2. Você pode pagar em qualquer agência bancária, casa lotérica ou internet banking
                  </p>
                  <p>
                    3. O prazo de compensação é de até 1 a 3 dias úteis
                  </p>
                  <p>
                    <strong className="text-neutral-900">Valor a pagar: {formatCurrency(order.totalAmount)}</strong>
                  </p>
                </div>

                <div className="mt-8">
                  <Button
                    variant="primary"
                    onClick={() => handleDownloadBoleto(order.id)}
                  >
                    <Download className="w-[1rem] h-[1rem] mr-2" />
                    Reenviar Boleto por E-mail
                  </Button>
                </div>

                <div className="mt-8 p-4 bg-warning-50 border border-warning-200 rounded-xl">
                  <p className="text-sm text-warning-800">
                    <strong>Atenção:</strong> Após o pagamento, o boleto pode levar até 3 dias úteis para ser compensado.
                    Você receberá uma notificação por e-mail quando o pagamento for confirmado.
                  </p>
                </div>

                <div className="mt-8 p-4 bg-primary-50 border border-primary-200 rounded-xl">
                  <p className="text-sm text-primary-800">
                    <strong>Dica:</strong> Para confirmação mais rápida, prefira pagamento via Pix ou cartão de crédito.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-lg font-display font-semibold text-neutral-900 mb-4">Ingressos</h2>
          <div className="space-y-4">
            {order.tickets.map((ticket: any, index: number) => (
              <div key={ticket.id} className="border border-neutral-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="font-medium text-neutral-900 mb-1">
                      {ticket.type} - {ticket.lot.name}
                    </div>
                    <div className="text-sm text-neutral-600 mb-4">
                      Código: {ticket.code}
                    </div>
                    <div className="text-sm">
                      <span className={`font-medium ${
                        ticket.isUsed ? 'text-success-600' : 'text-neutral-900'
                      }`}>
                        {formatCurrency(ticket.price)}
                      </span>
                      <span className={`mx-2 ${
                        ticket.isUsed ? 'text-success-600' : 'text-neutral-600'
                      }`}>
                        •
                      </span>
                      <span className={ticket.isUsed ? 'text-success-600' : 'text-neutral-600'}>
                        {ticket.isUsed ? 'Utilizado' : 'Não utilizado'}
                      </span>
                    </div>
                  </div>
                  {order.paymentStatus === 'APPROVED' && !ticket.isUsed && (
                    <div className="flex gap-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchQRCode(ticket.id)}
                        disabled={loadingQRCodes[ticket.id]}
                        loading={loadingQRCodes[ticket.id]}
                      >
                        {qrCodes[ticket.id] ? 'Atualizar QR Code' : 'Ver QR Code'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenResaleModal(ticket)}
                      >
                        <DollarSign className="w-[1rem] h-[1rem] mr-1" />
                        Vender
                      </Button>
                    </div>
                  )}
                </div>

                {order.paymentStatus === 'APPROVED' && qrCodes[ticket.id] && (
                  <div className="border-t border-neutral-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-neutral-900">
                        QR Code para Check-in
                      </h3>
                      <div className="flex gap-4">
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
                    <p className="text-xs text-neutral-600 mt-4 text-center">
                      Apresente este QR Code no local do evento para check-in
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-lg font-display font-semibold text-neutral-900 mb-4">Resumo do Valor</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Subtotal:</span>
              <span className="text-neutral-900">{formatCurrency(order.totalAmount)}</span>
            </div>
            {order.promocode && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Cupom ({order.promocode.code}):</span>
                <span className="text-success-600">- {formatCurrency(calculateDiscount(order))}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Taxa de Serviço:</span>
              <span className="text-neutral-900">Inclusa no total</span>
            </div>
            <div className="flex justify-between text-lg font-semibold pt-2 border-t">
              <span className="text-neutral-900">Total:</span>
              <span className="text-primary-600">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {order.refundRequested && !order.refundApproved && (
          <div className="bg-warning-50 border border-warning-200 rounded-2xl p-6">
            <div className="flex items-start">
              <AlertTriangle className="w-6 h-6 text-warning-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-lg font-display font-medium text-warning-800">Solicitação de Reembolso em Análise</h3>
                <p className="mt-1 text-sm text-warning-700">
                  Sua solicitação de reembolso está sendo processada. Você receberá uma notificação assim que for aprovada.
                </p>
              </div>
            </div>
          </div>
        )}

        {order.refundApproved && (
          <div className="bg-success-50 border border-success-200 rounded-2xl p-6">
            <div className="flex items-start">
              <CheckCircle className="w-6 h-6 text-success-600 mt-0.5 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-lg font-display font-medium text-success-800">Reembolso Aprovado</h3>
                <p className="mt-1 text-sm text-success-700">
                  Seu reembolso foi processado e o valor será devolvido ao método de pagamento original.
                </p>
              </div>
            </div>
          </div>
        )}

        {canRequestRefund && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6">
            <h3 className="text-lg font-display font-medium text-primary-900 mb-3">Solicitar Reembolso</h3>

            <div className="mb-4 space-y-2 text-sm text-primary-800">
              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                <span className="ml-2">
                  {isWithin7Days || isMoreThan48hBeforeEvent
                    ? 'Reembolso integral disponível'
                    : 'Reembolso parcial disponível'}
                </span>
              </div>

              {isWithin7Days && (
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" />
                  <span className="ml-2">
                    Dentro de 7 dias da compra - Taxas de serviço e processamento reembolsadas
                  </span>
                </div>
              )}

              {isMoreThan48hBeforeEvent && (
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" />
                  <span className="ml-2">
                    Mais de 48h antes do evento - Taxas de serviço reembolsadas
                  </span>
                </div>
              )}

              <div className="flex items-start">
                <AlertTriangle className="w-5 h-5 text-error-600 mt-0.5 flex-shrink-0" />
                <span className="ml-2">
                  Reembolsos só podem ser solicitados através do site
                </span>
              </div>
            </div>

            <Button
              onClick={handleRefundRequest}
              disabled={requestingRefund}
              variant="danger"
              className="w-full"
              loading={requestingRefund}
            >
              {requestingRefund ? 'Solicitando...' : 'Solicitar Reembolso'}
            </Button>
          </div>
        )}

        <div className="text-center">
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </main>

      {/* Resale Listing Modal */}
      <Modal
        isOpen={resaleModalOpen}
        onClose={handleCloseResaleModal}
        title="Vender Ingresso na Revenda"
        size="md"
      >
        {validatingResale ? (
          <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : resaleValidation && selectedTicket ? (
          <div className="space-y-4">
            {!resaleValidation.valid ? (
              <div className="bg-error-50 border border-error-200 rounded-xl p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-error-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-error-800">Não é possível vender este ingresso</h3>
                    <p className="mt-1 text-sm text-error-700">{resaleValidation.reason}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-primary-900 mb-2">Detalhes do Ingresso</h3>
                  <div className="space-y-4 text-sm text-primary-800">
                    <div>Evento: {resaleValidation.eventTitle}</div>
                    <div>Tipo: {selectedTicket.type} - {selectedTicket.lot.name}</div>
                    <div>Preço original: {formatCurrency(resaleValidation.originalPrice || 0)}</div>
                  </div>
                </div>

                <div>
                  <label htmlFor="resalePrice" className="block text-sm font-medium text-neutral-700 mb-1">
                    Preço de Revenda <span className="text-error-600">*</span>
                  </label>
                  <input
                    id="resalePrice"
                    name="resalePrice"
                    type="number"
                    value={resalePrice}
                    onChange={(e) => {
                      setResalePrice(e.target.value)
                      if (resalePriceError) setResalePriceError('')
                    }}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={resaleValidation.maxResalePrice}
                    className={cn(
                      "w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                      resalePriceError ? 'border-error-500' : 'border-neutral-300'
                    )}
                    required
                    aria-describedby="resale-price-help resale-price-error"
                    aria-invalid={!!resalePriceError}
                  />
                  {resalePriceError && (
                    <p id="resale-price-error" className="mt-1 text-sm text-error-600" role="alert">
                      {resalePriceError}
                    </p>
                  )}
                  <div id="resale-price-help" className="mt-4 space-y-4 text-sm">
                    <div className="text-neutral-600">
                      Preço máximo: {formatCurrency(resaleValidation.maxResalePrice || 0)}
                    </div>
                    <div className="text-neutral-600">
                      Taxa de revenda: 10% sobre o valor da venda
                    </div>
                    {resalePrice && !isNaN(parseFloat(resalePrice)) && (
                      <div className="text-neutral-600">
                        Você receberá: {formatCurrency((parseFloat(resalePrice) || 0) * 0.9)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <Info className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" />
                    <div className="ml-3 text-sm text-warning-800">
                      <p className="font-medium mb-1">Importante:</p>
                      <ul className="space-y-4 text-warning-700">
                        <li>• O listing expira em 30 dias</li>
                        <li>• Se vendido, o ingresso será transferido para o comprador</li>
                        <li>• Você receberá 90% do valor (taxa de 10%)</li>
                        <li>• Após listar, você pode cancelar a qualquer momento</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCloseResaleModal}
                    className="flex-1"
                    disabled={submittingResale}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSubmitResale}
                    className="flex-1"
                    disabled={!resalePrice || submittingResale}
                    loading={submittingResale}
                  >
                    {submittingResale ? 'Listando...' : 'Listar para Revenda'}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Pix QR Code Modal */}
      <Modal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        title="QR Code Pix"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-neutral-600 mb-8">
              Escaneie o QR Code abaixo para pagar
            </p>
            <div className="bg-white p-6 rounded-xl border-2 border-neutral-200 inline-block">
              {/* Simulated QR Code - In production, this would be the actual Pix QR code from payment gateway */}
              <div className="w-48 h-48 bg-neutral-100 rounded-lg flex items-center justify-center mx-auto">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-success-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-600">QR Code Pix</p>
                  <p className="text-lg font-bold text-neutral-900 mt-2">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 rounded-xl p-4">
            <p className="text-sm text-neutral-700 mb-4">
              Ou copie e cole o código:
            </p>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={generatePixPayload(order)}
                readOnly
                className="flex-1 px-4 py-4 text-sm bg-white border border-neutral-300 rounded-lg"
                aria-label="Código Pix para copiar"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyPixCode(generatePixPayload(order))}
              >
                <Copy className="w-[1rem] h-[1rem]" />
              </Button>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-primary-900 mb-4">Instruções de Pagamento</h4>
            <ol className="text-sm text-primary-800 space-y-4 list-decimal list-inside">
              <li>Abra o app do seu banco ou carteira digital</li>
              <li>Selecione &ldquo;Pagar com Pix&rdquo; e depois &ldquo;QR Code&rdquo;</li>
              <li>Aponte a câmera para este QR Code</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>

          <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
            <p className="text-sm text-warning-800">
              <strong>Prazo de confirmação:</strong> Até 30 minutos após o pagamento.
              Você receberá um e-mail quando o pagamento for confirmado.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setPixModalOpen(false)}
            className="w-full"
          >
            Entendido
          </Button>
        </div>
      </Modal>
    </AuthenticatedAppShell>
  )
}
