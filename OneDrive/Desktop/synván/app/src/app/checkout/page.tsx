'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Header } from '@/components/layout/header'
import { ArrowLeft, Check, X, Shield, Lock, CreditCard, CheckCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { formatCurrency } from '@/lib/utils/format'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { useToast } from '@/hooks/useToast'
import { useCart, formatTimeRemaining, isTimeLow } from '@/hooks/useCart'
import { cn } from '@/lib/cn'
import type { ApiError } from '@/hooks/useApi'
import { useFeePreview } from '@/hooks/useFeePreview'
import { Clock, AlertTriangle } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { cart, isLoaded: isCartLoaded, setItems: setCartItems, setPromocode: setCartPromocode, clearCart, timeRemaining } = useCart()

  const [eventId, setEventId] = useState<string | null>(null)
  const [lotId, setLotId] = useState<string | null>(null)
  const [event, setEvent] = useState<any>(null)
  const [lot, setLot] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<'tickets' | 'payment' | 'confirmation'>('tickets')
  const [cartExpired, setCartExpired] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [friendsAttending, setFriendsAttending] = useState<any[]>([])

  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [validatingPromo, setValidatingPromo] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountType: string; discountValue: number } | null>(null)
  const [promoError, setPromoError] = useState('')

  // Credit card state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'pix' | 'credit-card' | 'boleto' | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [installments, setInstallments] = useState(1)

  // Form validation errors
  const [cardErrors, setCardErrors] = useState<{
    cardNumber?: string
    cardHolderName?: string
    cardExpiry?: string
    cardCvv?: string
  }>({})

  // Get toast hook for notifications
  const toast = useToast()

  useEffect(() => {
    // Wait for cart to load from localStorage
    if (!isCartLoaded) return

    const { searchParams } = new URL(window.location.href)
    const evtId = searchParams.get('event')
    const ltId = searchParams.get('lot')

    if (evtId) {
      setEventId(evtId)

      // Load cart state if it exists for this event
      if (cart.eventId === evtId && cart.items.length > 0) {
        const firstItem = cart.items[0]
        setLotId(firstItem.lotId)
        setQuantity(firstItem.quantity)

        // Load promocode if exists
        if (cart.promocode) {
          setPromoCode(cart.promocode)
          // Validate the promocode to get details
          validatePromoCodeFromCart(cart.promocode, evtId)
        }

        // Fetch event data with loaded lot ID
        fetchEventData(evtId, firstItem.lotId)
      } else {
        // No cart items, fetch with URL lot ID
        setLotId(ltId)
        fetchEventData(evtId, ltId)
      }

      fetchSocialProof(evtId)
    }
  }, [isCartLoaded])

  // Validate promocode from cart
  const validatePromoCodeFromCart = async (code: string, evtId: string) => {
    try {
      const response = await fetch('/api/promocodes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          eventId: evtId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setAppliedPromo({
          code: data.promocode.code,
          discountType: data.promocode.discountType,
          discountValue: data.promocode.discountValue,
        })
      }
    } catch (error) {
      // Silently fail for promocode validation from cart
      toast.error('Erro ao validar cupom do carrinho')
    }
  }

  // Save cart to localStorage when quantity or lot changes
  useEffect(() => {
    if (isCartLoaded && eventId && lotId) {
      const items = [{
        lotId,
        quantity,
        ticketType: 'GENERAL' as const,
      }]
      setCartItems(items, eventId)
    }
  }, [quantity, lotId, isCartLoaded, eventId, setCartItems])

  // Update promocode in localStorage when it changes
  useEffect(() => {
    if (isCartLoaded) {
      setCartPromocode(appliedPromo?.code || null)
    }
  }, [appliedPromo, isCartLoaded, setCartPromocode])

  // Monitor cart expiration
  useEffect(() => {
    if (isCartLoaded && timeRemaining <= 0 && cart.items.length > 0) {
      setCartExpired(true)
      // Redirect to event page after showing alert
      setTimeout(() => {
        toast.error('Seu carrinho expirou. Por favor, selecione seus ingressos novamente.')
        if (eventId) {
          router.push(`/events/${eventId}`)
        }
      }, 2000)
    }
  }, [timeRemaining, isCartLoaded, cart.items.length, eventId, router])

  const fetchEventData = async (evtId: string, ltId: string | null) => {
    try {
      const response = await fetch(`/api/events/${evtId}`)
      const data = await response.json()

      if (response.ok) {
        setEvent(data.event)
        if (ltId) {
          const selectedLot = data.event.lots?.find((l: any) => l.id === ltId)
          setLot(selectedLot)
        } else {
          const activeLot = data.event.lots?.find((l: any) => l.isActive && l.availableQuantity > 0)
          setLot(activeLot)
        }
        setError(null)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar dados do evento',
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
  }

  const fetchSocialProof = async (evtId: string) => {
    try {
      const response = await fetch(`/api/events/${evtId}/social-proof`)
      const data = await response.json()

      if (response.ok) {
        setFriendsAttending(data.friends || [])
      }
    } catch (error) {
      // Silently fail for social proof - it's optional data
    }
  }

  const validatePromoCode = async () => {
    if (!promoCode.trim() || !eventId) {
      setPromoError('Digite um código promocional')
      return
    }

    setValidatingPromo(true)
    setPromoError('')

    try {
      const response = await fetch('/api/promocodes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode.trim(),
          eventId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setAppliedPromo({
          code: data.promocode.code,
          discountType: data.promocode.discountType,
          discountValue: data.promocode.discountValue,
        })
        toast.success('Cupom aplicado com sucesso!')
      } else {
        setPromoError(data.error || 'Cupom inválido')
        toast.error(data.error || 'Cupom inválido')
      }
    } catch (error) {
      setPromoError('Erro ao validar cupom')
      toast.error('Erro ao validar cupom')
    } finally {
      setValidatingPromo(false)
    }
  }

  const removePromoCode = () => {
    setAppliedPromo(null)
    setPromoCode('')
    setPromoError('')
  }

  const calculateDiscount = () => {
    if (!appliedPromo || !lot?.price) return 0

    const subtotal = lot.price * quantity

    if (appliedPromo.discountType === 'PERCENTAGE') {
      return (subtotal * appliedPromo.discountValue) / 100
    } else if (appliedPromo.discountType === 'FIXED') {
      return Math.min(appliedPromo.discountValue, subtotal)
    }

    return 0
  }

  // Calculate fees using server-side preview API for accurate display
  const feePreviewRequest = lot && eventId ? {
    eventId,
    ticketPrice: lot.price,
    quantity,
    feeAllocation: 'BUYER' as const,
    discount: calculateDiscount(),
  } : null

  const { feeBreakdown, isLoading: isLoadingFees } = useFeePreview(feePreviewRequest)

  const handlePayment = async (paymentMethod: string) => {
    if (!session?.user) {
      router.push('/auth/login?callbackUrl=' + encodeURIComponent(window.location.pathname + window.location.search))
      return
    }

    if (!eventId || !lot) {
      toast.error('Dados do evento não carregados')
      return
    }

    // For credit card, show form first
    if (paymentMethod === 'credit-card' && !selectedPaymentMethod) {
      setSelectedPaymentMethod('credit-card')
      return
    }

    // Close credit card form for other payment methods
    if (paymentMethod !== 'credit-card') {
      setSelectedPaymentMethod(null)
    }

    // Validate credit card form
    if (paymentMethod === 'credit-card') {
      if (!validateCardForm()) {
        toast.error('Por favor, preencha os dados do cartão corretamente')
        return
      }
    }

    setProcessing(true)

    try {
      const orderPayload: any = {
        eventId,
        items: [{
          lotId: lot.id,
          quantity,
        }],
        paymentMethod: paymentMethod.toUpperCase().replace('-', '_'),
        feeAllocation: 'BUYER',
        promocode: appliedPromo?.code,
      }

      // Add credit card data for credit card payments
      if (paymentMethod === 'credit-card') {
        orderPayload.paymentData = {
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardHolderName,
          cardExpiry,
          cardCvv,
          installments,
        }
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      })

      const data = await response.json()

      if (response.ok) {
        // Show success toast
        toast.success('Compra realizada com sucesso! Você será redirecionado para seus ingressos.')

        setShowConfetti(true)
        setStep('confirmation')

        // Clear cart after successful order
        clearCart()

        setTimeout(() => {
          router.push(`/orders/${data.order.id}`)
        }, 3000)
      } else {
        toast.error(data.error || 'Erro ao processar pagamento')
      }
    } catch (error) {
      toast.error('Erro ao processar pagamento')
    } finally {
      setProcessing(false)
    }
  }

  // Format card number with spaces (4 digits groups)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ')
    return formatted.substring(0, 19) // Max 16 digits + 3 spaces
  }

  // Format expiry date as MM/YY
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4)
    }
    return cleaned.substring(0, 4)
  }

  // Validate credit card form
  const validateCardForm = (): boolean => {
    const errors: typeof cardErrors = {}

    if (!cardNumber.replace(/\s/g, '') || cardNumber.replace(/\s/g, '').length < 13) {
      errors.cardNumber = 'Número do cartão inválido'
    }

    if (!cardHolderName || cardHolderName.trim().length < 3) {
      errors.cardHolderName = 'Nome no cartão é obrigatório'
    }

    if (!cardExpiry || !cardExpiry.includes('/')) {
      errors.cardExpiry = 'Data de validade inválida'
    } else {
      const [month, year] = cardExpiry.split('/')
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear() % 100
      const currentMonth = currentDate.getMonth() + 1

      if (!month || !year || parseInt(month) < 1 || parseInt(month) > 12) {
        errors.cardExpiry = 'Mês inválido'
      } else if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
        errors.cardExpiry = 'Cartão expirado'
      }
    }

    if (!cardCvv || cardCvv.length < 3) {
      errors.cardCvv = 'CVV inválido'
    }

    setCardErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Calculate installment amount
  const getInstallmentValue = () => {
    if (!feeBreakdown?.total || !installments) return 0
    return feeBreakdown.total / installments
  }

  const subtotal = lot?.price ? lot.price * quantity : 0
  const discount = calculateDiscount()
  const totalPrice = feeBreakdown?.total ?? subtotal - discount

  if (loading) {
    return (
      <div className="bg-neutral-50">
        <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <span className="sr-only">Carregando checkout...</span>
        </div>
      </div>
    )
  }

  if (!event || !lot) {
    if (error) {
      return (
        <div className="bg-neutral-50">
          <div className="min-h-screen flex items-center justify-center p-4">
            <ErrorState
              title="Erro ao Carregar Evento"
              message={getErrorMessageFromError(error)}
              variant={getErrorVariantFromStatus(error.status)}
              onRetry={() => {
                setError(null)
                setLoading(true)
                if (eventId) fetchEventData(eventId, lotId)
              }}
              onGoHome={() => router.push('/events')}
            />
          </div>
        </div>
      )
    }
    return (
      <div className="bg-neutral-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <ErrorState
            title="Evento Não Encontrado"
            message="O evento solicitado não foi encontrado ou os ingressos estão esgotados."
            variant="not-found"
            onGoHome={() => router.push('/events')}
          />
        </div>
      </div>
    )
  }

  // Cart expired state
  if (cartExpired) {
    return (
      <div className="bg-neutral-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-card p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-error-600" />
            </div>
            <h2 className="text-2xl font-bold font-display text-neutral-900 mb-2">
              Tempo Expirado
            </h2>
            <p className="text-neutral-600 mb-6">
              Seu carrinho expirou. Os ingressos foram liberados para outros compradores.
            </p>
            <button
              onClick={() => router.push(`/events/${eventId}`)}
              className="w-full h-14 gradient-primary text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-card-hover transition-all active:scale-95 font-semibold shadow-card"
            >
              Selecionar Ingressos Novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-neutral-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-600 mb-4" role="status" aria-live="polite"></div>
            <p className="text-neutral-600">Carregando dados do evento...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-50 text-neutral-900">
      {showConfetti && <ConfettiAnimation />}

      <div className="sticky top-0 z-50 glass border-b border-neutral-200/50">
        <div className="w-full px-4 py-3 md:max-w-md md:mx-auto lg:max-w-lg lg:mx-auto">
          <button
            onClick={() => {
              if (step === 'payment') {
                setStep('tickets')
              } else {
                router.back()
              }
            }}
            className="text-neutral-700 flex items-center gap-2 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
            {step === 'payment' ? 'Voltar' : 'Voltar'}
          </button>
        </div>
      </div>

      <main className="w-full px-4 py-6 md:max-w-md md:mx-auto lg:max-w-lg lg:mx-auto">
        {/* Step Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-display",
                step === 'tickets' ? 'gradient-primary text-white shadow-card' : 'bg-neutral-300 text-neutral-600'
              )}>
                1
              </div>
              <div className={cn(
                "h-1 w-8 rounded-full transition-colors",
                step === 'payment' || step === 'confirmation' ? 'gradient-primary' : 'bg-neutral-300'
              )}></div>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-display",
                step === 'payment' || step === 'confirmation' ? 'gradient-primary text-white shadow-card' : 'bg-neutral-300 text-neutral-600'
              )}>
                2
              </div>
              <div className="h-1 w-8"></div>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-display",
                step === 'confirmation' ? 'gradient-primary text-white shadow-card' : 'bg-neutral-300 text-neutral-600'
              )}>
                3
              </div>
            </div>

            {/* Cart Timer */}
            {step !== 'confirmation' && timeRemaining > 0 && (
              <div className={cn(
                "flex items-center gap-4 px-4 py-4 rounded-xl",
                isTimeLow(timeRemaining)
                  ? "bg-error-50 border-2 border-error-200 animate-pulse"
                  : "bg-neutral-50 border border-neutral-200"
              )}>
                {isTimeLow(timeRemaining) ? (
                  <AlertTriangle className="w-5 h-5 text-error-600 flex-shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-neutral-600 flex-shrink-0" />
                )}
                <div className="text-right">
                  <div className={cn(
                    "text-xs font-medium",
                    isTimeLow(timeRemaining) ? "text-error-700" : "text-neutral-600"
                  )}>
                    {isTimeLow(timeRemaining) ? 'Tempo expirando!' : 'Tempo restante'}
                  </div>
                  <div className={cn(
                    "text-lg font-bold font-display",
                    isTimeLow(timeRemaining) ? "text-error-700" : "text-neutral-900"
                  )}>
                    {formatTimeRemaining(timeRemaining)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-neutral-600">
            {step === 'tickets' && 'Selecione os ingressos'}
            {step === 'payment' && 'Escolha o pagamento'}
            {step === 'confirmation' && 'Confirmação'}
          </div>
        </div>

        {/* Confirmation Step */}
        {step === 'confirmation' && (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="bg-success-50 border-2 border-success-200 rounded-2xl p-6 text-center shadow-card">
              <div className="text-5xl mb-4" role="img" aria-label="Emoji de comemoração">🎉</div>
              <h2 className="text-2xl font-bold font-display text-success-700 mb-4">Compra Confirmada!</h2>
              <p className="text-neutral-700">Seu pedido foi realizado com sucesso</p>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h3 className="font-bold font-display text-lg mb-4 text-neutral-900">Resumo do Pedido</h3>
              <div className="flex items-start gap-4 mb-4 pb-4 border-b border-neutral-200">
                {event?.imageUrl && (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    width={100}
                    height={100}
                    sizes="80px"
                    className="w-20 h-20 object-cover rounded-xl"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-neutral-900">{event?.title}</h4>
                  <p className="text-sm text-neutral-600">{lot?.name}</p>
                  <p className="text-sm text-neutral-600">Quantidade: {quantity}</p>
                  <p className="text-sm font-semibold text-primary-600 mt-1">
                    {formatCurrency(feeBreakdown?.total || (lot?.price || 0) * quantity)}
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h3 className="font-bold font-display text-lg mb-4 text-neutral-900">Próximos Passos</h3>
              <ul className="space-y-4">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm" aria-hidden="true">1</div>
                  <div>
                    <p className="font-semibold text-neutral-900">Acesse seus ingressos</p>
                    <p className="text-sm text-neutral-600">Você será redirecionado para a página do pedido onde pode ver seus QR Codes</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm" aria-hidden="true">2</div>
                  <div>
                    <p className="font-semibold text-neutral-900">Baixe os ingressos</p>
                    <p className="text-sm text-neutral-600">Faça o download do PDF ou salve os QR Codes no seu celular</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm" aria-hidden="true">3</div>
                  <div>
                    <p className="font-semibold text-neutral-900">Adicione ao calendário</p>
                    <p className="text-sm text-neutral-600">Não perca o evento! Adicione a data ao seu calendário</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Helpful Tips */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6">
              <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Dicas Importantes
              </h3>
              <ul className="space-y-4 text-sm text-neutral-700">
                <li className="flex items-start gap-4">
                  <span className="text-primary-600 mt-0.5">•</span>
                  <span>Apresente o QR Code no dia do evento para check-in</span>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-primary-600 mt-0.5">•</span>
                  <span>Chegue com 30 minutos de antecedência</span>
                </li>
                <li className="flex items-start gap-4">
                  <span className="text-primary-600 mt-0.5">•</span>
                  <span>Os ingressos são intransferíveis após o check-in</span>
                </li>
              </ul>
            </div>

            {/* Redirect Info */}
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-4 text-neutral-600 text-sm">
                <div className="animate-spin rounded-full h-[1rem] w-[1rem] border-2 border-primary-600 border-t-transparent" aria-hidden="true"></div>
                <span>Você será redirecionado em instantes...</span>
              </div>
            </div>
          </div>
        )}

        {/* Tickets Step */}
        {step === 'tickets' && (
          <>
            <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-6 hover:shadow-card-hover transition-shadow">
              {event.imageUrl && (
                <Image
                  src={event.imageUrl}
                  alt={event.title}
                  width={800}
                  height={200}
                  sizes="100vw"
                  className="w-full h-48 object-cover"
                  priority
                />
              )}

              <div className="p-6">
                <h1 className="text-2xl font-bold font-display mb-2">{event.title}</h1>
                <div className="text-neutral-600 text-sm mb-4">
                  {new Date(event.startTime).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>

                {friendsAttending.length > 0 && (
                  <div className="mb-4 p-4 glass rounded-2xl border border-secondary-200/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex -space-x-2">
                        {friendsAttending.slice(0, 3).map((friend, i) => (
                          <div key={i} className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold font-display border-2 border-white shadow-card">
                            {friend.name[0]}
                          </div>
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-secondary-600">
                        {friendsAttending.length} amigos vão
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Seus amigos {friendsAttending.map((f: any) => f.name).join(', ')} também estarão lá! 🔥
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="text-sm text-neutral-600">{lot.name}</div>
                    <div className="text-2xl font-bold font-display text-primary-600">
                      {formatCurrency(lot.price)}
                    </div>
                    {/* Availability Display */}
                    {lot.availableQuantity !== undefined && lot.totalQuantity !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-neutral-600">
                          {lot.availableQuantity} de {lot.totalQuantity} disponíveis
                        </span>
                        {/* Low stock warning */}
                        {lot.availableQuantity <= lot.totalQuantity * 0.2 && lot.availableQuantity > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-800">
                            Últimas unidades!
                          </span>
                        )}
                        {/* Sold out badge */}
                        {lot.availableQuantity === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-error-100 text-error-800">
                            Esgotado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-100 rounded-xl p-2">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center text-2xl font-bold hover:bg-neutral-200 rounded-xl transition-colors"
                      disabled={quantity <= 1}
                      aria-label="Diminuir quantidade"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold">{quantity}</span>
                    <button
                      onClick={() => {
                        const maxQuantity = lot.availableQuantity !== undefined ? Math.min(lot.availableQuantity, 10) : 10
                        setQuantity(Math.min(maxQuantity, quantity + 1))
                      }}
                      className="w-10 h-10 flex items-center justify-center text-2xl font-bold hover:bg-neutral-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={lot.availableQuantity !== undefined && quantity >= lot.availableQuantity}
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Promo Code Section */}
                <div className="border-t border-neutral-200 pt-4 mb-4">
                  {!appliedPromo ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700">
                        Código Promocional
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                        <Input
                          type="text"
                          placeholder="Digite seu cupom"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          error={promoError}
                          className="flex-1 min-h-[44px]"
                          disabled={validatingPromo}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              validatePromoCode()
                            }
                          }}
                        />
                        <button
                          onClick={validatePromoCode}
                          disabled={validatingPromo || !promoCode.trim()}
                          className="px-4 py-2 gradient-primary text-white rounded-xl hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium min-h-[44px] sm:min-h-0"
                        >
                          {validatingPromo ? '...' : 'Aplicar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-success-50 border border-success-200 rounded-2xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-success-600" />
                          <div>
                            <div className="font-semibold text-success-800">
                              {appliedPromo.code}
                            </div>
                            <div className="text-sm text-success-600">
                              {appliedPromo.discountType === 'PERCENTAGE'
                                ? `${appliedPromo.discountValue}% de desconto`
                                : `${formatCurrency(appliedPromo.discountValue)} de desconto`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={removePromoCode}
                          className="p-1 hover:bg-success-100 rounded-xl transition-colors"
                          aria-label="Remover cupom"
                        >
                          <X className="w-[1rem] h-[1rem] text-success-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-200 pt-4">
                  {feeBreakdown && (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-neutral-600">Subtotal:</span>
                        <span className="text-neutral-600">{formatCurrency(feeBreakdown.subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-success-600">Desconto:</span>
                          <span className="text-success-600">
                            -{formatCurrency(discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-neutral-600">Taxa de serviço:</span>
                        <span className="text-neutral-600">{formatCurrency(feeBreakdown.serviceFee)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-neutral-600">Taxa de processamento:</span>
                        <span className="text-neutral-600">{formatCurrency(feeBreakdown.processingFee)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold font-display pt-2 border-t border-neutral-200">
                        <span>Total:</span>
                        <span className="text-primary-600">{formatCurrency(feeBreakdown.total)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep('payment')}
              className="w-full h-14 gradient-primary text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-card-hover transition-all active:scale-95 font-semibold shadow-card"
            >
              Continuar para o Pagamento
            </button>
          </>
        )}

        {/* Payment Step */}
        {step === 'payment' && (
          <>
            {/* Order Summary */}
            <div className="sticky top-16 z-40 glass rounded-2xl shadow-card overflow-hidden mb-6 p-6 md:static md:z-auto border border-neutral-200/50">
              <h2 className="text-lg font-bold font-display mb-4">Resumo do Pedido</h2>
              <div className="flex items-start gap-4 mb-4 pb-4 border-b border-neutral-200">
                {event.imageUrl && (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    width={100}
                    height={100}
                    sizes="80px"
                    className="w-20 h-20 object-cover rounded-xl"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-sm text-neutral-600">{lot.name}</p>
                  <p className="text-sm text-neutral-600">Quantidade: {quantity}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {feeBreakdown && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Subtotal:</span>
                      <span className="text-neutral-600">{formatCurrency(feeBreakdown.subtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-success-600">Desconto:</span>
                        <span className="text-success-600">
                          -{formatCurrency(discount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Taxa de serviço:</span>
                      <span className="text-neutral-600">{formatCurrency(feeBreakdown.serviceFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Taxa de processamento:</span>
                      <span className="text-neutral-600">{formatCurrency(feeBreakdown.processingFee)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold font-display pt-2 border-t border-neutral-200">
                      <span>Total:</span>
                      <span className="text-primary-600">{formatCurrency(feeBreakdown.total)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Security Badges */}
            <div className="glass rounded-2xl p-4 mb-4 border border-success-200/50">
              <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
                <Shield className="w-[1rem] h-[1rem] text-success-600" />
                Pagamento 100% Seguro
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-card mb-1">
                    <Lock className="w-5 h-5 text-success-600" />
                  </div>
                  <span className="text-xs text-neutral-600">Criptografia<br/>SSL</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-card mb-1">
                    <CreditCard className="w-5 h-5 text-success-600" />
                  </div>
                  <span className="text-xs text-neutral-600">Dados<br/>Protegidos</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-card mb-1">
                    <CheckCircle className="w-5 h-5 text-success-600" />
                  </div>
                  <span className="text-xs text-neutral-600">Compra<br/>Garantida</span>
                </div>
              </div>
            </div>

            {/* Payment Methods Trust */}
            <div className="bg-white rounded-xl p-4 mb-4 border border-neutral-200 shadow-card">
              <div className="flex items-center justify-center gap-4 text-xs text-neutral-600">
                <div className="flex items-center gap-1">
                  <div className="w-8 h-5 bg-neutral-100 rounded flex items-center justify-center">
                    <span className="text-[8px] font-bold text-neutral-600">PIX</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-5 bg-neutral-100 rounded flex items-center justify-center">
                    <span className="text-[8px] font-bold text-neutral-600">VISA</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-5 bg-neutral-100 rounded flex items-center justify-center">
                    <span className="text-[8px] font-bold text-neutral-600">MC</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-5 bg-neutral-100 rounded flex items-center justify-center">
                    <span className="text-[8px] font-bold text-neutral-600">BOLETO</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit Card Form */}
            {selectedPaymentMethod === 'credit-card' && (
              <div className="bg-white rounded-2xl shadow-elevated p-6 mb-4 border border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold font-display flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-secondary-600" />
                    Dados do Cartão
                  </h3>
                  <button
                    onClick={() => setSelectedPaymentMethod(null)}
                    className="text-neutral-500 hover:text-neutral-600 transition-colors"
                    aria-label="Fechar formulário"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Card Number */}
                  <FormField
                    name="cardNumber"
                    label="Número do Cartão"
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(value) => setCardNumber(formatCardNumber(value))}
                    error={cardErrors.cardNumber}
                    required
                    autoComplete="cc-number"
                    helperText="Somente números"
                  />

                  {/* Card Holder Name */}
                  <FormField
                    name="cardHolderName"
                    label="Nome no Cartão"
                    type="text"
                    placeholder="NOME COMO ESTÁ NO CARTÃO"
                    value={cardHolderName}
                    onChange={(value) => setCardHolderName(value.toUpperCase())}
                    error={cardErrors.cardHolderName}
                    required
                    autoComplete="cc-name"
                    helperText="Exatamente como impresso no cartão"
                  />

                  {/* Expiry and CVV */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      name="cardExpiry"
                      label="Validade"
                      type="text"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(value) => setCardExpiry(formatExpiry(value))}
                      error={cardErrors.cardExpiry}
                      required
                      autoComplete="cc-exp"
                      helperText="Mês/Ano"
                    />
                    <FormField
                      name="cardCvv"
                      label="CVV"
                      type="password"
                      placeholder="123"
                      value={cardCvv}
                      onChange={(value) => setCardCvv(value.replace(/\D/g, '').substring(0, 3))}
                      error={cardErrors.cardCvv}
                      required
                      autoComplete="cc-csc"
                      helperText="3 dígitos no verso"
                    />
                  </div>

                  {/* Installments */}
                  <FormField
                    name="installments"
                    label="Parcelas"
                    type="select"
                    value={installments.toString()}
                    onChange={(value) => setInstallments(parseInt(value) || 1)}
                    options={Array.from({ length: Math.min(10, Math.ceil(totalPrice / 10)) }, (_, i) => {
                      const installmentNum = i + 1
                      const installmentValue = getInstallmentValue()
                      return {
                        value: installmentNum.toString(),
                        label: installmentNum === 1
                          ? `À vista (${formatCurrency(totalPrice)})`
                          : `${installmentNum}x de ${formatCurrency(installmentValue / installmentNum)}${installmentNum > 1 ? ` (Total: ${formatCurrency(totalPrice)})` : ''}`
                      }
                    })}
                    required
                    helperText="Sem juros"
                  />
                </div>

                <div className="mt-4 p-3 glass rounded-xl flex items-start gap-2 border border-primary-200/50">
                  <Lock className="w-[1rem] h-[1rem] text-primary-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-neutral-700">
                    Seus dados são criptografados e processados com segurança. Não armazenamos as informações do seu cartão.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (validateCardForm()) {
                      handlePayment('credit-card')
                    }
                  }}
                  disabled={processing}
                  aria-busy={processing}
                  aria-live="polite"
                  className="w-full mt-4 h-14 gradient-primary text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 font-semibold shadow-card"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" aria-hidden="true"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Pagar {installments > 1 ? `${installments}x de ${formatCurrency(getInstallmentValue() / installments)}` : formatCurrency(totalPrice)}
                    </>
                  )}
                </button>
              </div>
            )}

            {!session?.user && (
              <div className="mb-4 p-4 glass border border-warning-200 rounded-2xl">
                <div className="text-center text-sm text-warning-800">
                  <a
                    href="/auth/login?callbackUrl=/checkout"
                    className="font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-1"
                  >
                    Faça login
                  </a>
                  {' '}para finalizar a compra
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Pix */}
              <button
                onClick={() => handlePayment('pix')}
                disabled={processing || !session?.user || selectedPaymentMethod === 'credit-card'}
                className="w-full h-14 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 font-semibold shadow-card"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-13l-1 2h2l-1 2 3-3h-2l1-2h-2z"/>
                </svg>
                Pagar com Pix
              </button>

              {/* Credit Card - hide when form is showing */}
              {selectedPaymentMethod !== 'credit-card' && (
                <button
                  onClick={() => setSelectedPaymentMethod('credit-card')}
                  disabled={processing || !session?.user}
                  className="w-full h-14 gradient-primary text-white rounded-xl flex items-center justify-center gap-2 hover:shadow-card-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 font-semibold shadow-card"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Cartão de Crédito
                </button>
              )}

              {/* Boleto */}
              <button
                onClick={() => handlePayment('boleto')}
                disabled={processing || !session?.user || selectedPaymentMethod === 'credit-card'}
                className="w-full h-14 bg-neutral-800 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 font-semibold shadow-card"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Boleto Bancário
              </button>

              {session?.user && (
                <div className="mt-4 p-4 glass rounded-2xl flex items-center gap-3 border border-success-200/50">
                  <div className="text-2xl">✨</div>
                  <div className="text-sm">
                    <div className="font-semibold text-success-600">Continuar como {session.user.name}</div>
                    <div className="text-neutral-600">Pagamento rápido ativado</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 space-y-3">
          {/* Security Features */}
          <div className="flex items-center justify-center gap-4 text-xs text-neutral-600">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>SSL Seguro</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>Proteção contra Fraude</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              <span>LGPD Compliant</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-neutral-500">
            <p>🔒 Ambiente seguro com criptografia de ponta a ponta</p>
            <p className="mt-1">Powered by Simprão · Pagamento processado por gateway certificado PCI DSS</p>
          </div>
        </div>
      </main>
    </div>
  )
}

function ConfettiAnimation() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="text-8xl animate-bounce" aria-hidden="true">🎉</div>
      <span className="sr-only">Compra confirmada com sucesso</span>
    </div>
  )
}
