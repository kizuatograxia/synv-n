'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/hooks/useToast'
import { ArrowLeft, Calendar, MapPin, Ticket, User, CheckCircle, Info, CreditCard, QrCode } from 'lucide-react'
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
    lot: {
      name: string
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

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix', description: 'Pagamento instantâneo com QR Code' },
  { value: 'credit-card', label: 'Cartão de Crédito', description: 'Pagamento em até 12x' },
  { value: 'boleto', label: 'Boleto', description: 'Pagamento em até 3 dias úteis' },
]

export default function ResalePurchasePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const toast = useToast()

  const [listing, setListing] = useState<ResaleListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'pix' | 'credit-card' | 'boleto' | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/auth/login?callbackUrl=/resale/${params.id}`)
    }
  }, [status, params.id, router])

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await fetch(`/api/resale/${params.id}`)
        const data = await response.json()

        if (response.ok) {
          setListing(data)
        } else {
          setError(data.error || 'Listing não encontrado')
        }
      } catch (err) {
        setError('Erro ao buscar listing')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchListing()
    }
  }, [params.id, status])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const calculateFee = (price: number) => {
    const fee = price * 0.10
    return {
      fee,
      sellerReceives: price - fee,
    }
  }

  const handleOpenPurchaseModal = () => {
    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=/resale/${params.id}`)
      return
    }
    setPurchaseModalOpen(true)
  }

  const handleClosePurchaseModal = () => {
    setPurchaseModalOpen(false)
    setSelectedPaymentMethod(null)
  }

  const handlePurchase = async () => {
    if (!selectedPaymentMethod || !listing) return

    setProcessing(true)

    try {
      const response = await fetch(`/api/resale/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: selectedPaymentMethod,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Ingresso comprado com sucesso!')
        router.push(`/orders/${data.order.id}`)
      } else {
        toast.error(data.error || 'Erro ao comprar ingresso')
      }
    } catch (err) {
      toast.error('Erro ao comprar ingresso. Tente novamente.')
    } finally {
      setProcessing(false)
    }
  }

  const isExpired = listing ? new Date(listing.expiresAt) < new Date() : false
  const isSold = listing?.status === 'SOLD'
  const isCancelled = listing?.status === 'CANCELLED'

  const canBuy = listing && listing.status === 'ACTIVE' && !isExpired && listing.seller.id !== session?.user?.id

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64" role="status" aria-live="polite" aria-busy="true">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" aria-hidden="true"></div>
            <span className="sr-only">Carregando anúncio de revenda...</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div role="alert" aria-live="assertive" className="bg-white rounded-2xl shadow-card p-8 text-center">
            <h1 className="text-2xl font-display font-bold text-neutral-900 mb-4">
              {error || 'Listing não encontrado'}
            </h1>
            <Button
              onClick={() => router.push('/resale')}
              variant="primary"
            >
              Voltar para Revenda
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const { fee, sellerReceives } = calculateFee(listing.resalePrice)

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <nav className="mb-4" aria-label="Navegação de retorno">
          <button
            onClick={() => router.push('/resale')}
            className="flex items-center text-neutral-600 hover:text-primary-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-xl px-2 py-1"
            aria-label="Voltar para página de revenda"
          >
            <ArrowLeft className="w-[1rem] h-[1rem] mr-2" aria-hidden="true" />
            Voltar para Revenda
          </button>
        </nav>

        <div className="space-y-6">
          {/* Event Details */}
          <section className="bg-white rounded-2xl shadow-card overflow-hidden" aria-labelledby="event-details-heading">
            {listing.event.imageUrl && (
              <div className="relative h-48 w-full" role="img" aria-label={`Imagem do evento: ${listing.event.title}`}>
                <Image
                  src={listing.event.imageUrl}
                  alt={listing.event.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <h1 id="event-details-heading" className="text-2xl font-display font-bold text-neutral-900 mb-4">
                {listing.event.title}
              </h1>

              <dl className="space-y-3 text-sm">
                <div className="flex items-start">
                  <dt className="flex items-center">
                    <Calendar className="w-5 h-5 text-neutral-600 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium text-neutral-900">Data e Horário</span>
                  </dt>
                  <dd className="ml-6 text-neutral-600">{formatDate(listing.event.startTime)}</dd>
                </div>

                <div className="flex items-start">
                  <dt className="flex items-center">
                    <MapPin className="w-5 h-5 text-neutral-600 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium text-neutral-900">Local</span>
                  </dt>
                  <dd className="ml-6 text-neutral-600">{listing.event.location || 'Online'}</dd>
                </div>

                <div className="flex items-start">
                  <dt className="flex items-center">
                    <Ticket className="w-5 h-5 text-neutral-600 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium text-neutral-900">Tipo de Ingresso</span>
                  </dt>
                  <dd className="ml-6 text-neutral-600">
                    {listing.ticket.type} - {listing.ticket.lot.name}
                    {listing.ticket.seat && (
                      <div className="text-neutral-600 text-sm mt-1" role="status" aria-live="polite">
                        Assento: {listing.ticket.seat.label}
                      </div>
                    )}
                  </dd>
                </div>

                <div className="flex items-start">
                  <dt className="flex items-center">
                    <User className="w-5 h-5 text-neutral-600 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    <span className="font-medium text-neutral-900">Vendedor</span>
                  </dt>
                  <dd className="ml-6 text-neutral-600">{listing.seller.name}</dd>
                </div>
              </dl>

              <div className="mt-4 flex gap-2" role="status" aria-live="polite">
                <Badge
                  variant={
                    listing.status === 'ACTIVE' ? 'success' :
                    listing.status === 'SOLD' ? 'info' :
                    listing.status === 'CANCELLED' ? 'error' :
                    'warning'
                  }
                  size="md"
                >
                  {listing.status === 'ACTIVE' ? 'Ativo' :
                   listing.status === 'SOLD' ? 'Vendido' :
                   listing.status === 'CANCELLED' ? 'Cancelado' :
                   'Expirado'}
                </Badge>
                {isExpired && (
                  <Badge variant="warning" size="md">
                    Expirado em {formatDate(listing.expiresAt)}
                  </Badge>
                )}
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="bg-white rounded-2xl shadow-card p-6" aria-labelledby="pricing-heading" aria-live="polite">
            <h2 id="pricing-heading" className="text-lg font-display font-semibold text-neutral-900 mb-4">Preço</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Preço Original:</span>
                <span className="text-neutral-900 line-through" aria-label={`Preço original: ${formatCurrency(listing.originalPrice)}`}>{formatCurrency(listing.originalPrice)}</span>
              </div>

              <div className="flex justify-between text-lg font-semibold">
                <span className="text-neutral-900">Preço de Revenda:</span>
                <span className="text-primary-600" aria-label={`Preço de revenda: ${formatCurrency(listing.resalePrice)}`}>{formatCurrency(listing.resalePrice)}</span>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Taxa de Revenda (10%):</span>
                  <span className="text-neutral-900" aria-label={`Taxa de serviço: ${formatCurrency(fee)}`}>{formatCurrency(fee)}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-neutral-600">Vendedor recebe:</span>
                  <span className="text-success-600 font-medium" aria-label={`Valor líquido do vendedor: ${formatCurrency(sellerReceives)}`}>{formatCurrency(sellerReceives)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Purchase Flow */}
          {canBuy ? (
            <section className="bg-white rounded-2xl shadow-card p-6" aria-labelledby="purchase-heading">
              <h2 id="purchase-heading" className="text-lg font-display font-semibold text-neutral-900 mb-4">Comprar Ingresso</h2>

              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handlePurchase(); }} aria-label="Formulário de compra de ingresso de revenda">
                <fieldset className="border-0 p-0 m-0">
                  <legend className="block text-sm font-medium text-neutral-700 mb-2">
                    Método de Pagamento <span className="text-error-600" aria-label="obrigatório">*</span>
                  </legend>
                  <Select
                    id="paymentMethod"
                    name="paymentMethod"
                    value={selectedPaymentMethod || ''}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value as any)}
                    options={[
                      { value: '', label: 'Selecione o método de pagamento' },
                      ...PAYMENT_METHODS
                    ]}
                    required
                    aria-describedby="payment-method-description"
                    aria-invalid={!selectedPaymentMethod}
                    aria-required="true"
                  />
                  <p id="payment-method-description" className="sr-only">
                    Selecione Pix para pagamento instantâneo, Cartão de Crédito para parcelamento ou Boleto para pagamento em até 3 dias úteis
                  </p>
                </fieldset>

                {selectedPaymentMethod && (
                  <div className="bg-primary-50 border border-primary-200 rounded-xl p-4" role="status" aria-live="polite">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <div className="ml-3 text-sm text-primary-800">
                        <p className="font-medium mb-1">Pagamento Selecionado</p>
                        <p>{PAYMENT_METHODS.find(m => m.value === selectedPaymentMethod)?.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/resale')}
                    className="flex-1"
                    aria-label="Cancelar compra e voltar para lista de revenda"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    disabled={!selectedPaymentMethod || processing}
                    loading={processing}
                    aria-live="polite"
                    aria-busy={processing}
                  >
                    <span className="sr-only">{processing ? 'Processando compra. ' : ''}</span>
                    {processing ? 'Processando...' : `Comprar por ${formatCurrency(listing.resalePrice)}`}
                  </Button>
                </div>
              </form>
            </section>
          ) : (
            <aside className="bg-warning-50 border border-warning-200 rounded-2xl p-6" role="alert" aria-live="assertive" aria-atomic="true">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div className="ml-3 text-sm text-warning-800">
                  <p className="font-medium mb-1" role="status">
                    {isSold ? 'Este ingresso já foi vendido' :
                     isCancelled ? 'Este listing foi cancelado' :
                     isExpired ? 'Este listing expirou' :
                     listing.seller.id === session?.user?.id ? 'Você não pode comprar seu próprio ingresso' :
                     'Este ingresso não está disponível'}
                  </p>
                </div>
              </div>
            </aside>
          )}

          {/* Important Info */}
          <aside className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6" aria-labelledby="important-info-heading" role="complementary">
            <h3 id="important-info-heading" className="text-sm font-display font-semibold text-neutral-900 mb-3">Informações Importantes</h3>
            <ul className="space-y-2 text-sm text-neutral-700" role="list">
              <li className="flex items-start">
                <CheckCircle className="w-[1rem] h-[1rem] text-success-600 mt-0.5 mr-2 flex-shrink-0" aria-hidden="true" />
                <span>Após a compra, você receberá um novo ingresso com QR Code único</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-[1rem] h-[1rem] text-success-600 mt-0.5 mr-2 flex-shrink-0" aria-hidden="true" />
                <span>O ingresso original será invalidado e transferido automaticamente</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-[1rem] h-[1rem] text-success-600 mt-0.5 mr-2 flex-shrink-0" aria-hidden="true" />
                <span>Todas as transações são seguras e rastreadas</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-[1rem] h-[1rem] text-success-600 mt-0.5 mr-2 flex-shrink-0" aria-hidden="true" />
                <span>Você terá acesso ao ingresso na sua conta após a confirmação do pagamento</span>
              </li>
            </ul>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
