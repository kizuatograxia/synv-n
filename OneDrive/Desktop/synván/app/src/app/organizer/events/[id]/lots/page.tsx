'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonCard } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { FormField } from '@/components/ui/form-field'
import { useToast } from '@/hooks/useToast'
import type { ApiError } from '@/hooks/useApi'
import { getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { Calendar, MapPin, Plus, Edit, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Ticket, ArrowLeft } from 'lucide-react'
import Image from 'next/image'

interface Lot {
  id: string
  name: string
  price: number
  totalQuantity: number
  availableQuantity: number
  startDate: string
  endDate: string | null
  isActive: boolean
  _count?: {
    tickets: number
  }
}

interface Event {
  id: string
  title: string
  description: string
  slug: string
  startTime: string
  endTime: string | null
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  imageUrl: string | null
  isPublished: boolean
}

type FormData = {
  name: string
  price: string
  totalQuantity: string
  startDate: string
  endDate: string
  isActive: boolean
}

const emptyForm: FormData = {
  name: '',
  price: '',
  totalQuantity: '',
  startDate: new Date().toISOString().slice(0, 16),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  isActive: true
}

export default function EventLotsPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null)

  // Form state
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch(`/api/events/${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setEvent(data.event)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar evento',
          status: response.status,
          code: data.code
        }
        setError(apiError)
      }
    } catch (err) {
      // Event fetch error is not critical
    }
  }, [params.id])

  const fetchLots = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/events/${params.id}/lots`)
      const data = await response.json()

      if (response.ok) {
        setLots(data.lots || [])
        setError(null)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar lotes',
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
  }, [params.id])

  useEffect(() => {
    fetchEvent()
    fetchLots()
  }, [params.id, fetchEvent, fetchLots])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = 'Nome do lote é obrigatório'
    }

    if (!formData.price) {
      errors.price = 'Preço é obrigatório'
    } else {
      const price = parseFloat(formData.price)
      if (isNaN(price) || price < 0) {
        errors.price = 'Preço deve ser um valor positivo'
      }
    }

    if (!formData.totalQuantity) {
      errors.totalQuantity = 'Quantidade total é obrigatória'
    } else {
      const qty = parseInt(formData.totalQuantity, 10)
      if (isNaN(qty) || qty <= 0) {
        errors.totalQuantity = 'Quantidade total deve ser maior que zero'
      }
    }

    if (!formData.startDate) {
      errors.startDate = 'Data de início é obrigatória'
    }

    if (formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
      errors.endDate = 'Data final deve ser posterior à data de início'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/events/${params.id}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          price: parseFloat(formData.price),
          totalQuantity: parseInt(formData.totalQuantity, 10),
          availableQuantity: parseInt(formData.totalQuantity, 10),
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
          isActive: formData.isActive
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Lote criado com sucesso!')
        setCreateModalOpen(false)
        setFormData(emptyForm)
        setFormErrors({})
        await fetchLots()
      } else {
        toast.error(data.error || 'Erro ao criar lote')
      }
    } catch (error) {
      toast.error('Erro ao criar lote. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedLot || !validateForm()) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/events/${params.id}/lots/${selectedLot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          price: parseFloat(formData.price),
          totalQuantity: parseInt(formData.totalQuantity, 10),
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
          isActive: formData.isActive
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Lote atualizado com sucesso!')
        setEditModalOpen(false)
        setSelectedLot(null)
        setFormData(emptyForm)
        setFormErrors({})
        await fetchLots()
      } else {
        toast.error(data.error || 'Erro ao atualizar lote')
      }
    } catch (error) {
      toast.error('Erro ao atualizar lote. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedLot) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/events/${params.id}/lots/${selectedLot.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Lote deletado com sucesso!')
        setDeleteModalOpen(false)
        setSelectedLot(null)
        await fetchLots()
      } else {
        toast.error(data.error || 'Erro ao deletar lote')
      }
    } catch (error) {
      toast.error('Erro ao deletar lote. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (lot: Lot) => {
    try {
      const response = await fetch(`/api/events/${params.id}/lots/${lot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !lot.isActive })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(lot.isActive ? 'Lote desativado' : 'Lote ativado')
        await fetchLots()
      } else {
        toast.error(data.error || 'Erro ao atualizar lote')
      }
    } catch (error) {
      toast.error('Erro ao atualizar lote. Tente novamente.')
    }
  }

  const openEditModal = (lot: Lot) => {
    setSelectedLot(lot)
    setFormData({
      name: lot.name,
      price: lot.price.toString(),
      totalQuantity: lot.totalQuantity.toString(),
      startDate: new Date(lot.startDate).toISOString().slice(0, 16),
      endDate: lot.endDate ? new Date(lot.endDate).toISOString().slice(0, 16) : '',
      isActive: lot.isActive
    })
    setFormErrors({})
    setEditModalOpen(true)
  }

  const openDeleteModal = (lot: Lot) => {
    setSelectedLot(lot)
    setDeleteModalOpen(true)
  }

  // Note: Reordering is not supported by the current API
  // The lots are ordered by startDate by default
  // This is a frontend-only display ordering

  if (loading) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Gerenciar Lotes"
          subtitle="Crie e edite os lotes de ingressos do evento"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div>
            <SkeletonCard />
          </div>
        </div>
      </OrganizerAppShell>
    )
  }

  if (error) {
    return (
      <OrganizerAppShell>
        <PageHeader
          title="Gerenciar Lotes"
          subtitle="Crie e edite os lotes de ingressos do evento"
        />
        <ErrorState
          title="Erro ao Carregar Lotes"
          message={getErrorMessageFromError(error)}
          variant={getErrorVariantFromStatus(error.status)}
          onRetry={() => fetchLots()}
          onGoBack={() => router.push('/organizer/events')}
        />
      </OrganizerAppShell>
    )
  }

  const now = new Date()
  const activeLots = lots.filter(lot => lot.isActive && new Date(lot.endDate || lot.startDate) > now)
  const inactiveLots = lots.filter(lot => !lot.isActive || new Date(lot.endDate || lot.startDate) <= now)

  return (
    <OrganizerAppShell>
      <main className="space-y-6">
        <PageHeader
          title="Gerenciar Lotes"
          subtitle="Crie e edite os lotes de ingressos do evento"
          breadcrumbs={[
            { label: 'Meus Eventos', href: '/organizer/events' },
            { label: event?.title || 'Evento', href: `/organizer/events/${params.id}/manage` },
            { label: 'Lotes' },
          ]}
        />

        {/* Event Summary */}
        {event && (
          <Card className="p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {event.imageUrl ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                    <Image
                      src={event.imageUrl}
                      alt={event.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-8 h-8 text-white/80" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{event.title}</h2>
                  {event.city && (
                    <div className="flex items-center gap-4 text-sm text-neutral-600 mt-4">
                      <MapPin className="w-[1rem] h-[1rem]" />
                      <span>{event.city}{event.state && `, ${event.state}`}</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={() => router.push(`/organizer/events/${params.id}/manage`)}
              >
                <ArrowLeft className="w-[1rem] h-[1rem] mr-4" />
                Voltar
              </Button>
            </div>
          </Card>
        )}

        {/* Create Lot Button */}
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setFormData(emptyForm)
              setFormErrors({})
              setCreateModalOpen(true)
            }}
          >
            <Plus className="w-[1rem] h-[1rem] mr-4" />
            Criar Novo Lote
          </Button>
        </div>

        {/* Lots List */}
        {lots.length === 0 ? (
          <EmptyState
            icon={<Ticket className="w-12 h-12" />}
            title="Nenhum Lote Criado"
            description="Crie lotes de ingressos para começar a vender."
            action={{
              label: 'Criar Primeiro Lote',
              onClick: () => setCreateModalOpen(true),
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Active Lots */}
            {activeLots.length > 0 && (
              <div>
                <h3 className="text-lg font-display font-semibold text-neutral-900 mb-4">
                  Lotes Ativos
                </h3>
                <div className="space-y-4">
                  {activeLots.map((lot) => (
                    <LotCard
                      key={lot.id}
                      lot={lot}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                      onEdit={() => openEditModal(lot)}
                      onDelete={() => openDeleteModal(lot)}
                      onToggleActive={() => handleToggleActive(lot)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive/Expired Lots */}
            {inactiveLots.length > 0 && (
              <div>
                <h3 className="text-lg font-display font-semibold text-neutral-900 mb-4">
                  Lotes Inativos/Expirados
                </h3>
                <div className="space-y-4">
                  {inactiveLots.map((lot) => (
                    <LotCard
                      key={lot.id}
                      lot={lot}
                      formatCurrency={formatCurrency}
                      formatDate={formatDate}
                      onEdit={() => openEditModal(lot)}
                      onDelete={() => openDeleteModal(lot)}
                      onToggleActive={() => handleToggleActive(lot)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create Lot Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Criar Novo Lote"
        size="lg"
      >
        <LotForm
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          onSubmit={handleCreate}
          onCancel={() => setCreateModalOpen(false)}
          submitLabel="Criar Lote"
          submitting={submitting}
        />
      </Modal>

      {/* Edit Lot Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Lote"
        size="lg"
      >
        <LotForm
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          onSubmit={handleEdit}
          onCancel={() => setEditModalOpen(false)}
          submitLabel="Salvar Alterações"
          submitting={submitting}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Deletar Lote"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-error-50 border border-error-200 rounded-xl p-4">
            <p className="text-sm text-error-800">
              Ao deletar este lote, ele será removido permanentemente do evento.
            </p>
          </div>

          {selectedLot && (
            <div className="text-sm text-neutral-700">
              <p><strong>Lote:</strong> {selectedLot.name}</p>
              <p><strong>Preço:</strong> {formatCurrency(selectedLot.price)}</p>
              <p><strong>Ingressos vendidos:</strong> {selectedLot.totalQuantity - selectedLot.availableQuantity} de {selectedLot.totalQuantity}</p>
            </div>
          )}

          <div className="space-y-3 text-sm text-neutral-700">
            <p><strong>O que acontece ao deletar:</strong></p>
            <ul className="space-y-2 list-disc list-inside">
              <li>O lote será removido do evento</li>
              <li>Ingressos já vendidos deste lote permanecem válidos</li>
              <li>Esta ação não pode ser desfeita</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-8">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={submitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={submitting}
              loading={submitting}
              className="flex-1"
            >
              Deletar Lote
            </Button>
          </div>
        </div>
      </Modal>
    </OrganizerAppShell>
  )
}

interface LotCardProps {
  lot: Lot
  formatCurrency: (value: number) => string
  formatDate: (dateString: string) => string
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}

function LotCard({ lot, formatCurrency, formatDate, onEdit, onDelete, onToggleActive }: LotCardProps) {
  const sold = lot.totalQuantity - lot.availableQuantity
  const percentage = lot.totalQuantity > 0 ? (sold / lot.totalQuantity) * 100 : 0
  const now = new Date()
  const isExpired = lot.endDate && new Date(lot.endDate) < now

  return (
    <Card className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Lot Info */}
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <h4 className="text-lg font-semibold text-neutral-900">{lot.name}</h4>
                <Badge variant={lot.isActive ? 'success' : 'neutral'} size="sm">
                  {lot.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
                {isExpired && (
                  <Badge variant="warning" size="sm">Expirado</Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(lot.price)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-neutral-600">Vendidos</p>
              <p className="font-semibold text-neutral-900">{sold} de {lot.totalQuantity}</p>
            </div>
            <div>
              <p className="text-neutral-600">Disponíveis</p>
              <p className="font-semibold text-neutral-900">{lot.availableQuantity}</p>
            </div>
            <div>
              <p className="text-neutral-600">Início</p>
              <p className="font-semibold text-neutral-900">{formatDate(lot.startDate)}</p>
            </div>
            <div>
              <p className="text-neutral-600">Fim</p>
              <p className="font-semibold text-neutral-900">{lot.endDate ? formatDate(lot.endDate) : 'Sem limite'}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-neutral-600">{percentage.toFixed(1)}% vendido</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex lg:flex-col gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleActive}
            aria-label={lot.isActive ? 'Desativar lote' : 'Ativar lote'}
          >
            {lot.isActive ? (
              <>
                <EyeOff className="w-[1rem] h-[1rem] mr-4" aria-hidden="true" />
                Desativar
              </>
            ) : (
              <>
                <Eye className="w-[1rem] h-[1rem] mr-4" aria-hidden="true" />
                Ativar
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            aria-label="Editar lote"
          >
            <Edit className="w-[1rem] h-[1rem] mr-4" aria-hidden="true" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            aria-label="Deletar lote"
          >
            <Trash2 className="w-[1rem] h-[1rem] mr-4" aria-hidden="true" />
            Deletar
          </Button>
        </div>
      </div>
    </Card>
  )
}

interface LotFormProps {
  formData: FormData
  setFormData: (data: FormData) => void
  formErrors: Record<string, string>
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  submitting: boolean
}

function LotForm({ formData, setFormData, formErrors, onSubmit, onCancel, submitLabel, submitting }: LotFormProps) {
  return (
    <div className="space-y-4">
      <FormField
        name="name"
        label="Nome do Lote"
        type="text"
        value={formData.name}
        onChange={(value) => setFormData({ ...formData, name: value })}
        placeholder="Ex: Primeiro Lote, Lote Promocional, etc."
        required
        error={formErrors.name}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          name="price"
          label="Preço (R$)"
          type="number"
          value={formData.price}
          onChange={(value) => setFormData({ ...formData, price: value })}
          placeholder="0.00"
          required
          error={formErrors.price}
        />

        <FormField
          name="totalQuantity"
          label="Quantidade Total"
          type="number"
          value={formData.totalQuantity}
          onChange={(value) => setFormData({ ...formData, totalQuantity: value })}
          placeholder="100"
          required
          error={formErrors.totalQuantity}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          name="startDate"
          label="Data de Início"
          type="datetime-local"
          value={formData.startDate}
          onChange={(value) => setFormData({ ...formData, startDate: value })}
          required
          error={formErrors.startDate}
        />

        <FormField
          name="endDate"
          label="Data de Fim (opcional)"
          type="datetime-local"
          value={formData.endDate}
          onChange={(value) => setFormData({ ...formData, endDate: value })}
          error={formErrors.endDate}
          helperText="Deixe vazio para sem data limite"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-[1rem] h-[1rem] rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-neutral-900">
          Lote ativo (disponível para venda)
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={submitting}
          loading={submitting}
          className="flex-1"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
