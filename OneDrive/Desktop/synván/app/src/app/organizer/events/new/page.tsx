'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { FormField } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { ImageUrlInput } from '@/components/ui/image-url-input'
import { useToast } from '@/hooks/useToast'
import { Plus, Trash2, Calendar, MapPin } from 'lucide-react'
import { cn } from '@/lib/cn'

// Validation schema matching the backend API
const eventSchema = z.object({
  title: z.string().min(3, 'Título deve ter pelo menos 3 caracteres').max(200, 'Título deve ter no máximo 200 caracteres'),
  slug: z.string().min(3, 'Slug deve ter pelo menos 3 caracteres').max(100, 'Slug deve ter no máximo 100 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras, números e hífens'),
  description: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres').max(5000, 'Descrição deve ter no máximo 5000 caracteres'),
  startTime: z.string().min(1, 'Data/hora início é obrigatória'),
  endTime: z.string().optional(),
  location: z.string().max(200, 'Local deve ter no máximo 200 caracteres').optional(),
  address: z.string().max(500, 'Endereço deve ter no máximo 500 caracteres').optional(),
  city: z.string().max(100, 'Cidade deve ter no máximo 100 caracteres').optional(),
  state: z.string().optional(),
  imageUrl: z.string().url('URL da imagem deve ser válida').optional().or(z.literal('')),
  isPublished: z.boolean().default(false)
})

type EventFormData = {
  title: string
  description: string
  slug: string
  startTime: string
  endTime?: string
  location?: string
  address?: string
  city?: string
  state?: string
  imageUrl?: string
  isPublished: boolean
}

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

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export default function OrganizerEventsPage() {
  const router = useRouter()
  const toast = useToast()

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    slug: '',
    startTime: '',
    endTime: '',
    location: '',
    address: '',
    city: '',
    state: '',
    imageUrl: '',
    isPublished: false
  })

  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [lots, setLots] = useState<Lot[]>([])

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleFieldChange = (field: keyof EventFormData, value: string | boolean) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)

    // Clear error for this field when user types
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }

    // Auto-generate slug from title
    if (field === 'title' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, slug: generateSlug(value) }))
    }
  }

  const validateForm = () => {
    try {
      eventSchema.parse(formData)
      setErrors({})
      return true
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof EventFormData, string>> = {}
        err.issues.forEach((issue) => {
          const field = issue.path[0] as keyof EventFormData
          fieldErrors[field] = issue.message
        })
        setErrors(fieldErrors)
      }
      return false
    }
  }

  const handleSubmit = async (publish: boolean = false) => {
    if (!validateForm()) {
      toast.error('Por favor, corrija os erros no formulário')
      return
    }

    setLoading(true)
    const submitData = { ...formData, isPublished: publish }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error || 'Erro ao criar evento'
        toast.error(errorMessage)

        // Handle validation errors from backend
        if (data.details) {
          const newErrors: Partial<Record<keyof EventFormData, string>> = {}
          data.details.forEach((issue: any) => {
            const path = issue.path[0] as keyof EventFormData
            newErrors[path] = issue.message
          })
          setErrors(newErrors)
        }
        setLoading(false)
        return
      }

      // Create lots if any were added
      if (lots.length > 0) {
        const lotsPromises = lots.map(lot =>
          fetch(`/api/events/${data.event.id}/lots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: lot.name,
              price: lot.price,
              totalQuantity: lot.totalQuantity,
              availableQuantity: lot.availableQuantity,
              startDate: lot.startDate,
              endDate: lot.endDate,
              isActive: lot.isActive
            })
          }).then(async (response) => {
            if (!response.ok) {
              const lotData = await response.json()
              throw new Error(lotData.error || `Erro ao criar lote ${lot.name}`)
            }
            return response.json()
          })
        )

        try {
          await Promise.all(lotsPromises)
        } catch (lotError: any) {
          toast.error(lotError.message || 'Erro ao criar lotes')
          setLoading(false)
          return
        }
      }

      toast.success(publish ? 'Evento publicado com sucesso!' : 'Rascunho salvo com sucesso!')

      // Redirect to event detail or organizer events list
      if (publish) {
        router.push(`/events/${data.event.id}`)
      } else {
        router.push('/organizer/events')
      }
    } catch (err) {
      toast.error('Erro ao criar evento. Tente novamente.')
      setLoading(false)
    }
  }

  // Lot management functions
  const addLot = () => {
    const newLot: Lot = {
      id: crypto.randomUUID(),
      name: '',
      price: 0,
      totalQuantity: 100,
      availableQuantity: 100,
      startDate: formData.startTime || '',
      endDate: formData.endTime || '',
      isActive: true
    }
    setLots([...lots, newLot])
  }

  const updateLot = (id: string, field: keyof Lot, value: string | number | boolean) => {
    setLots(lots.map(lot =>
      lot.id === id ? { ...lot, [field]: value } : lot
    ))
  }

  const removeLot = (id: string) => {
    setLots(lots.filter(lot => lot.id !== id))
  }

  return (
    <OrganizerAppShell>
      <main className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-8">
          <h1 className={cn("text-3xl font-display font-bold text-neutral-900")}>
            Criar Novo Evento
          </h1>
          <p className="mt-2 text-neutral-600">
            Preencha os dados do evento. Você pode salvar como rascunho e publicar depois.
          </p>
        </div>

        <div className="space-y-8">
          {/* Basic Information Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-primary-600" />
              <h2 className={cn("text-xl font-display font-semibold text-neutral-900")}>Informações Básicas</h2>
            </div>

            <div className="space-y-6">
              <FormField
                name="title"
                label="Título do Evento"
                placeholder="Ex: Rock Festival 2024"
                required
                value={formData.title}
                onChange={(value) => handleFieldChange('title', value)}
                error={errors.title}
                helperText="O nome que aparecerá na listagem de eventos"
                schema={eventSchema.shape.title}
              />

              <FormField
                name="slug"
                label="Slug (URL)"
                placeholder="rock-festival-2024"
                required
                value={formData.slug}
                onChange={(value) => handleFieldChange('slug', value)}
                error={errors.slug}
                helperText="Identificador único para a URL do evento (gerado automaticamente)"
                schema={eventSchema.shape.slug}
              />

              <MarkdownEditor
                value={formData.description}
                onChange={(value) => handleFieldChange('description', value)}
                label="Descrição"
                placeholder="Descreva seu evento..."
                required
                error={errors.description}
                helperText="Mínimo de 10 caracteres. Seja detalhado para atrair mais participantes."
              />

              {/* Image URL with enhanced preview */}
              <ImageUrlInput
                value={formData.imageUrl || ''}
                onChange={(value) => handleFieldChange('imageUrl', value)}
                error={errors.imageUrl}
                label="URL da Imagem"
                helperText="URL da imagem de capa do evento"
                schema={eventSchema.shape.imageUrl}
                name="imageUrl"
              />
            </div>
          </Card>

          {/* Date and Time Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-primary-600" />
              <h2 className={cn("text-xl font-display font-semibold text-neutral-900")}>Data e Horário</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                name="startTime"
                type="datetime-local"
                label="Data/Hora Início"
                required
                value={formData.startTime}
                onChange={(value) => handleFieldChange('startTime', value)}
                error={errors.startTime}
                schema={eventSchema.shape.startTime}
              />

              <FormField
                name="endTime"
                type="datetime-local"
                label="Data/Hora Fim"
                value={formData.endTime}
                onChange={(value) => handleFieldChange('endTime', value)}
                error={errors.endTime}
                helperText="Opcional. Deixe em branco se o evento não tem horário definido para encerrar."
              />
            </div>
          </Card>

          {/* Location Card */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-primary-600" />
              <h2 className={cn("text-xl font-display font-semibold text-neutral-900")}>Localização</h2>
            </div>

            <div className="space-y-6">
              <FormField
                name="location"
                label="Local"
                placeholder="Ex: Estádio do Morumbi"
                value={formData.location}
                onChange={(value) => handleFieldChange('location', value)}
                error={errors.location}
                helperText="Nome do local ou estabelecimento"
                schema={eventSchema.shape.location}
              />

              <FormField
                name="address"
                label="Endereço"
                placeholder="Av. Francisco Morato, 5645"
                value={formData.address}
                onChange={(value) => handleFieldChange('address', value)}
                error={errors.address}
                schema={eventSchema.shape.address}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  name="city"
                  label="Cidade"
                  placeholder="São Paulo"
                  value={formData.city}
                  onChange={(value) => handleFieldChange('city', value)}
                  error={errors.city}
                  schema={eventSchema.shape.city}
                />

                <FormField
                  name="state"
                  type="select"
                  label="Estado"
                  value={formData.state || ''}
                  onChange={(value) => handleFieldChange('state', value)}
                  error={errors.state}
                  options={[{ value: '', label: 'Selecione...' }, ...brazilianStates.map(state => ({ value: state, label: state }))]}
                />
              </div>
            </div>
          </Card>

          {/* Ticket Lots Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Badge variant="info">Opcional</Badge>
                <h2 className={cn("text-xl font-display font-semibold text-neutral-900")}>Lotes de Ingressos</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLot}
              >
                <Plus className="w-[1rem] h-[1rem] mr-1" />
                Adicionar Lote
              </Button>
            </div>

            <p className="text-sm text-neutral-600 mb-4">
              Você pode adicionar lotes agora ou criar depois na página do evento.
            </p>

            {lots.length === 0 ? (
              <div className="text-center py-8 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300">
                <p className="text-neutral-600">Nenhum lote adicionado</p>
                <p className="text-sm text-neutral-600 mt-1">Clique em &quot;Adicionar Lote&quot; para criar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lots.map((lot, index) => (
                  <div key={lot.id} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={cn("font-medium text-neutral-900 font-display")}>Lote {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLot(lot.id)}
                        className="text-error-600 hover:text-error-700"
                      >
                        <Trash2 className="w-[1rem] h-[1rem]" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Nome do Lote *
                        </label>
                        <input
                          type="text"
                          value={lot.name}
                          onChange={(e) => updateLot(lot.id, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Ex: Primeiro Lote"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Preço (R$) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lot.price}
                          onChange={(e) => updateLot(lot.id, 'price', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Quantidade Total *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={lot.totalQuantity}
                          onChange={(e) => updateLot(lot.id, 'totalQuantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Disponível *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={lot.availableQuantity}
                          onChange={(e) => updateLot(lot.id, 'availableQuantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Status
                        </label>
                        <select
                          value={lot.isActive ? 'true' : 'false'}
                          onChange={(e) => updateLot(lot.id, 'isActive', e.target.value === 'true')}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="true">Ativo</option>
                          <option value="false">Inativo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Data Início *
                        </label>
                        <input
                          type="datetime-local"
                          value={lot.startDate}
                          onChange={(e) => updateLot(lot.id, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Data Fim *
                        </label>
                        <input
                          type="datetime-local"
                          value={lot.endDate}
                          onChange={(e) => updateLot(lot.id, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t border-neutral-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              variant="soft"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              loading={loading}
            >
              Salvar como Rascunho
            </Button>

            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading}
              loading={loading}
            >
              Publicar Evento
            </Button>
          </div>
        </div>
      </main>
    </OrganizerAppShell>
  )
}
