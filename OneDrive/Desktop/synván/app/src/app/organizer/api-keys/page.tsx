'use client'

import { useState } from 'react'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Key, Plus, Trash2, Copy, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import { useApi, useApiMutation } from '@/hooks/useApi'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/cn'

interface ApiKey {
  id: string
  name: string
  key: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

const SCOPE_OPTIONS = [
  { value: 'events', label: 'Eventos' },
  { value: 'orders', label: 'Pedidos' },
  { value: 'tickets', label: 'Ingressos' },
  { value: 'checkin', label: 'Check-in' },
  { value: 'analytics', label: 'Análises' },
  { value: 'webhooks', label: 'Webhooks' },
]

export default function ApiKeysPage() {
  const toast = useToast()
  const { data: apiKeysData, error, isLoading, mutate } = useApi<{ apiKeys: ApiKey[] }>('/api/api-keys')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [showKeyModalOpen, setShowKeyModalOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['events'])
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)

  const createMutation = useApiMutation<any, { name: string; scopes: string[] }>('/api/api-keys', 'POST')
  const deleteMutation = useApiMutation<any, void>(`/api/api-keys/${selectedKey?.id}`, 'DELETE')

  const apiKeys = apiKeysData?.apiKeys || []

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Nome da chave é obrigatório')
      return
    }

    if (selectedScopes.length === 0) {
      toast.error('Selecione pelo menos um escopo')
      return
    }

    try {
      const result = await createMutation.trigger({
        name: newKeyName,
        scopes: selectedScopes,
      })

      if (result?.key) {
        setNewlyCreatedKey(result.key)
        setShowKeyModalOpen(true)
      }

      setCreateModalOpen(false)
      setNewKeyName('')
      setSelectedScopes(['events'])
      mutate()
      toast.success('API key criada com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar API key')
    }
  }

  const handleDeleteKey = async () => {
    if (!selectedKey) return

    try {
      await deleteMutation.trigger()
      setDeleteModalOpen(false)
      setSelectedKey(null)
      mutate()
      toast.success('API key revogada com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao revogar API key')
    }
  }

  const openDeleteModal = (apiKey: ApiKey) => {
    setSelectedKey(apiKey)
    setDeleteModalOpen(true)
  }

  const copyToClipboard = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopiedToClipboard(true)
      toast.success('Chave copiada para a área de transferência!')
      setTimeout(() => setCopiedToClipboard(false), 2000)
    } catch (err) {
      toast.error('Erro ao copiar chave')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getScopeBadge = (scope: string) => {
    const scopeOption = SCOPE_OPTIONS.find(s => s.value === scope)
    return (
      <Badge key={scope} variant="info" className="text-sm">
        {scopeOption?.label || scope}
      </Badge>
    )
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key
    return `${key.slice(0, 8)}${'*'.repeat(20)}${key.slice(-4)}`
  }

  const columns = [
    {
      key: 'name',
      label: 'Nome',
      render: (_: any, row: ApiKey) => (
        <div className="flex items-center gap-2">
          <Key className="w-[1rem] h-[1rem] text-neutral-600" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'key',
      label: 'Chave',
      render: (_: any, row: ApiKey) => (
        <code className="text-sm bg-neutral-100 px-2 py-1 rounded font-mono text-neutral-700">
          {maskApiKey(row.key)}
        </code>
      ),
    },
    {
      key: 'scopes',
      label: 'Escopos',
      render: (_: any, row: ApiKey) => (
        <div className="flex flex-wrap gap-4">
          {row.scopes.slice(0, 2).map(scope => getScopeBadge(scope))}
          {row.scopes.length > 2 && (
            <Badge variant="neutral" className="text-sm">
              +{row.scopes.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'lastUsedAt',
      label: 'Último Uso',
      render: (value: string | null) => formatDate(value),
    },
    {
      key: 'expiresAt',
      label: 'Expira em',
      render: (value: string | null) => formatDate(value),
    },
    {
      key: 'actions',
      label: 'Ações',
      render: (_: any, row: ApiKey) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openDeleteModal(row)}
            className="text-error-600 hover:text-error-800 transition-colors"
            aria-label={`Revogar chave ${row.name}`}
            title="Revogar chave"
          >
            <Trash2 className="w-[1rem] h-[1rem]" />
          </button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <OrganizerAppShell>
        <main className="space-y-6" aria-live="polite" aria-busy="true">
          {/* Page Header Skeleton */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-8 bg-neutral-200 rounded animate-pulse w-48" />
              <div className="h-5 bg-neutral-200 rounded animate-pulse w-96" />
            </div>
            <div className="h-10 bg-neutral-200 rounded animate-pulse w-32" />
          </div>

          {/* Table Skeleton */}
          <SkeletonTable rowCount={5} columnCount={5} />
        </main>
      </OrganizerAppShell>
    )
  }

  return (
    <OrganizerAppShell>
      <main className="space-y-8">
        {error && (
          <div className="bg-error-50 border border-error-200 text-error-600 px-4 py-3 rounded-xl flex items-center gap-2" role="alert">
            <AlertCircle className="w-5 h-5" />
            <span>Erro ao carregar chaves de API</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className={cn("text-3xl font-display font-bold text-neutral-900")}>Chaves de API</h1>
            <p className="text-neutral-600 mt-2">
              Gerencie suas chaves de API para integrações com sistemas externos
            </p>
          </div>
          <Button
            variant="gradient"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-[1rem] h-[1rem]" />
            Nova Chave
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-info-50 border-info-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-info-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className={cn("font-display font-semibold text-info-900 mb-2")}>
                  Sobre Chaves de API
                </h3>
                <ul className="text-sm text-info-800 space-y-4">
                  <li>• Use chaves de API para integrar com sistemas externos e automatizar tarefas</li>
                  <li>• Cada chave pode ter permissões específicas (escopos) para acessar diferentes recursos</li>
                  <li>• Mantenha suas chaves seguras e não as compartilhe publicamente</li>
                  <li>• Revogue chaves que não estão mais em uso para manter sua conta segura</li>
                </ul>
                <div className="mt-4">
                  <a
                    href="/docs/api"
                    className="inline-flex items-center gap-2 text-sm font-medium text-info-700 hover:text-info-900 transition-colors"
                  >
                    <ExternalLink className="w-[1rem] h-[1rem]" />
                    Documentação da API
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Table */}
        <Card>
          <CardHeader>
            <CardTitle>Minhas Chaves</CardTitle>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <p className="text-neutral-600">Nenhuma chave de API encontrada</p>
                <p className="text-neutral-600 text-sm mt-2">
                  Crie sua primeira chave para começar a integrar com sistemas externos
                </p>
              </div>
            ) : (
              <Table
                columns={columns}
                data={apiKeys}
                caption="Lista de chaves de API do organizador"
              />
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-error-200">
          <CardHeader className="border-b border-error-200">
            <CardTitle className="text-error-600">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-error-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className={cn("font-display font-semibold text-error-900 mb-2")}>
                  Revogação de Chaves
                </h3>
                <p className="text-sm text-error-800">
                  Revogar uma chave é uma ação permanente. Todas as integrações que usam essa chave deixarão de funcionar imediatamente.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Create API Key Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Criar Nova Chave de API"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Nome da Chave <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Minha Integração"
              autoFocus
            />
            <p className="text-sm text-neutral-600 mt-1">
              Um nome descritivo para identificar esta chave (ex: Integração CRM, App Mobile)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Escopos de Acesso <span className="text-error-500">*</span>
            </label>
            <p className="text-sm text-neutral-600 mb-2">
              Selecione quais recursos esta chave poderá acessar
            </p>
            <div className="space-y-4">
              {SCOPE_OPTIONS.map((scope) => (
                <label key={scope.value} className="flex items-center gap-3 p-3 border border-neutral-200 rounded-xl hover:bg-neutral-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedScopes([...selectedScopes, scope.value])
                      } else {
                        setSelectedScopes(selectedScopes.filter(s => s !== scope.value))
                      }
                    }}
                    className="w-[1rem] h-[1rem] text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <span className="font-medium text-neutral-700">{scope.label}</span>
                  <span className="text-sm text-neutral-600 ml-auto font-mono">
                    {scope.value}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-warning-50 border border-warning-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-warning-800">
                <p className="font-semibold mb-1">Importante</p>
                <p>A chave completa será mostrada apenas uma vez após a criação. Salve-a em um local seguro.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={createMutation.isMutating}
            >
              Cancelar
            </Button>
            <Button
              variant="gradient"
              onClick={handleCreateKey}
              disabled={createMutation.isMutating || !newKeyName.trim() || selectedScopes.length === 0}
            >
              {createMutation.isMutating ? 'Criando...' : 'Criar Chave'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Revogar Chave de API"
      >
        <div className="space-y-4">
          <p className="text-neutral-600">
            Tem certeza que deseja revogar a chave{' '}
            <span className="font-semibold text-neutral-900">{selectedKey?.name}</span>?
          </p>
          <p className="text-sm text-neutral-600">
            Esta ação não pode ser desfeita. Qualquer integração usando esta chave deixará de funcionar.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleteMutation.isMutating}
            >
              Manter Chave
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteKey}
              disabled={deleteMutation.isMutating}
            >
              {deleteMutation.isMutating ? 'Revogando...' : 'Revogar Chave'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Show Created Key Modal */}
      <Modal
        isOpen={showKeyModalOpen}
        onClose={() => {
          setShowKeyModalOpen(false)
          setNewlyCreatedKey(null)
          setCopiedToClipboard(false)
        }}
        title="Chave de API Criada"
      >
        <div className="space-y-4">
          <div className="bg-success-50 border border-success-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-success-800">
              <p className="font-semibold mb-1">Chave criada com sucesso!</p>
              <p>Salve esta chave agora. Você não poderá vê-la novamente.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Sua Chave de API
            </label>
            <p className="text-sm text-neutral-600 mb-2">
              Copie e salve esta chave em um local seguro
            </p>
            <div className="flex gap-2">
              <input
                type={copiedToClipboard ? 'text' : 'password'}
                readOnly
                value={newlyCreatedKey || ''}
                className="flex-1 px-4 py-2 bg-neutral-100 border border-neutral-300 rounded-xl text-sm font-mono"
              />
              <Button
                variant="outline"
                onClick={() => newlyCreatedKey && copyToClipboard(newlyCreatedKey)}
                className="flex items-center gap-2"
              >
                {copiedToClipboard ? (
                  <>
                    <CheckCircle className="w-[1rem] h-[1rem]" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-[1rem] h-[1rem]" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              variant="gradient"
              onClick={() => {
                setShowKeyModalOpen(false)
                setNewlyCreatedKey(null)
                setCopiedToClipboard(false)
              }}
            >
              Entendi, Salvei minha Chave
            </Button>
          </div>
        </div>
      </Modal>
    </OrganizerAppShell>
  )
}
