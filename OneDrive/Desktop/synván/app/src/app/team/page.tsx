'use client'

import { useCallback, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { z } from 'zod'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Tabs } from '@/components/ui/tabs'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { TeamRole } from '@/lib/services/team-types'
import { inviteSchema, type InviteFormValues } from '@/lib/validations/team'
import { cn } from '@/lib/cn'
import type { ApiError } from '@/hooks/useApi'

export default function TeamManagementPage() {
  const params = useParams()
  const { data: session } = useSession()
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [activeTab, setActiveTab] = useState('members')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>(TeamRole.VIEWER)
  const [inviteErrors, setInviteErrors] = useState<Partial<Record<keyof InviteFormValues, string>>>({})
  const [error, setError] = useState<ApiError | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  const fetchTeamMembers = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch(
        `/api/team-members?eventId=${params.eventId}`
      )
      const data = await response.json()

      if (response.ok) {
        setTeamMembers(data.teamMembers || [])
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao carregar membros da equipe',
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
  }, [params.eventId])

  const fetchActivityLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const response = await fetch(
        `/api/team-members/activity-logs?eventId=${params.eventId}`
      )
      const data = await response.json()

      if (response.ok) {
        setActivityLogs(data.activityLogs || [])
      } else {
        // Don't show error for activity logs - it's optional supplementary data
        setActivityLogs([])
      }
    } catch (error) {
      // Don't show error for activity logs - it's optional supplementary data
      setActivityLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }, [params.eventId])

  useEffect(() => {
    if (params.eventId && session?.user?.id) {
      fetchTeamMembers()
    }
  }, [params.eventId, session?.user?.id, fetchTeamMembers])

  useEffect(() => {
    if (activeTab === 'logs' && params.eventId && session?.user?.id) {
      fetchActivityLogs()
    }
  }, [activeTab, params.eventId, session?.user?.id, fetchActivityLogs])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage('')

    // Client-side validation using Zod schema
    try {
      inviteSchema.parse({
        email: inviteEmail,
        role: inviteRole
      })
      setInviteErrors({})
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof InviteFormValues, string>> = {}
        err.issues.forEach((issue) => {
          const field = issue.path[0] as keyof InviteFormValues
          fieldErrors[field] = issue.message
        })
        setInviteErrors(fieldErrors)
      }
      return
    }

    try {
      const response = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          eventId: params.eventId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setShowInviteModal(false)
        setInviteEmail('')
        setInviteRole(TeamRole.VIEWER)
        setInviteErrors({})
        setSuccessMessage('Convite enviado com sucesso!')
        fetchTeamMembers()
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        const apiError: ApiError = {
          message: data.error || data.message || 'Erro ao enviar convite',
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
    }
  }

  const handleInviteEmailChange = (value: string) => {
    setInviteEmail(value)
    // Clear field error when user types
    if (inviteErrors.email) {
      setInviteErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.email
        return newErrors
      })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro?')) {
      return
    }

    setError(null)
    try {
      const response = await fetch(`/api/team-members/${memberId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage('Membro removido com sucesso!')
        fetchTeamMembers()
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        const apiError: ApiError = {
          message: data.error || 'Erro ao remover membro',
          status: response.status,
          code: data.code
        }
        setError(apiError)
      }
    } catch (error) {
      const apiError: ApiError = {
        message: 'Erro ao remover membro',
        status: undefined
      }
      setError(apiError)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: TeamRole) => {
    setError(null)
    try {
      const response = await fetch(`/api/team-members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccessMessage('Cargo atualizado com sucesso!')
        fetchTeamMembers()
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        const apiError: ApiError = {
          message: data.error || 'Erro ao atualizar cargo',
          status: response.status,
          code: data.code
        }
        setError(apiError)
      }
    } catch (error) {
      const apiError: ApiError = {
        message: 'Erro ao atualizar cargo',
        status: undefined
      }
      setError(apiError)
    }
  }

  if (loading) {
    return (
      <OrganizerAppShell>
        <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <span className="sr-only">Carregando equipe...</span>
        </div>
      </OrganizerAppShell>
    )
  }

  const getRoleLabel = (role: TeamRole) => {
    switch (role) {
      case TeamRole.ADMIN:
        return 'Admin'
      case TeamRole.EDITOR:
        return 'Editor'
      case TeamRole.VIEWER:
        return 'Visualizador'
      default:
        return role
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success'
      case 'PENDING':
        return 'warning'
      case 'REMOVED':
        return 'error'
      default:
        return 'neutral'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Ativo'
      case 'PENDING':
        return 'Pendente'
      case 'REMOVED':
        return 'Removido'
      default:
        return status
    }
  }

  const getMemberInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name.charAt(0).toUpperCase()
    }
    return email.charAt(0).toUpperCase()
  }

  const getActionLabel = (action: string) => {
    const actionLabels: Record<string, string> = {
      CREATE_EVENT: 'Criar evento',
      EDIT_EVENT: 'Editar evento',
      VIEW_ANALYTICS: 'Ver análises',
      MANAGE_TICKETS: 'Gerenciar ingressos',
      REMOVE_MEMBER: 'Remover membro',
      INVITE_MEMBER: 'Convidar membro',
      UPDATE_ROLE: 'Atualizar cargo',
    }
    return actionLabels[action] || action
  }

  const getActionVariant = (action: string) => {
    const actionVariants: Record<string, any> = {
      CREATE_EVENT: 'success',
      EDIT_EVENT: 'info',
      VIEW_ANALYTICS: 'neutral',
      MANAGE_TICKETS: 'info',
      REMOVE_MEMBER: 'error',
      INVITE_MEMBER: 'success',
      UPDATE_ROLE: 'warning',
    }
    return actionVariants[action] || 'neutral'
  }

  return (
    <OrganizerAppShell>
      <main className="max-w-7xl mx-auto p-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-neutral-900">
              Equipe do Evento
            </h1>
            <p className="text-neutral-600 mt-1">
              Gerencie permissões e visualize atividades da equipe
            </p>
          </div>
          <Button
            onClick={() => setShowInviteModal(true)}
            variant="gradient"
          >
            Convidar Membro
          </Button>
        </div>

        {error && (
          <ErrorState
            title="Erro na Operação"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => {
              setError(null)
              fetchTeamMembers()
            }}
          />
        )}

        {successMessage && (
          <div className="bg-success-50 border border-success-200 text-success-600 px-4 py-3 rounded-lg mb-6" role="status">
            {successMessage}
          </div>
        )}

        <Tabs
          tabs={[
            {
              id: 'members',
              label: 'Membros',
              content: (
                <div className="bg-white rounded-2xl shadow-card border border-neutral-200 -mx-4 -my-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                      <span className="sr-only">Carregando membros...</span>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-2">👥</div>
                      <p className="text-lg font-medium text-neutral-900 mb-1">
                        Nenhum membro na equipe ainda
                      </p>
                      <p className="text-sm text-neutral-600">
                        Convide seu primeiro membro para começar
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block">
                        <Table
                          columns={[
                            {
                              key: 'member',
                              label: 'Membro',
                              render: (_, row) => (
                                <div className="flex items-center">
                                  <div className="h-10 w-10 flex-shrink-0">
                                    <div className="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                                      {getMemberInitials(row.user?.name, row.user?.email || row.id)}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-neutral-900">
                                      {row.user?.name || 'Pendente'}
                                    </div>
                                    <div className="text-sm text-neutral-600">
                                      {row.user?.email || row.id}
                                    </div>
                                  </div>
                                </div>
                              )
                            },
                            {
                              key: 'role',
                              label: 'Cargo',
                              render: (_, row) => (
                                <select
                                  value={row.role}
                                  onChange={(e) =>
                                    handleUpdateRole(row.id, e.target.value as TeamRole)
                                  }
                                  className="text-sm border border-neutral-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 px-2 py-1"
                                  aria-label={`Alterar cargo de ${row.user?.name || 'membro'}`}
                                >
                                  <option value={TeamRole.ADMIN}>{getRoleLabel(TeamRole.ADMIN)}</option>
                                  <option value={TeamRole.EDITOR}>{getRoleLabel(TeamRole.EDITOR)}</option>
                                  <option value={TeamRole.VIEWER}>{getRoleLabel(TeamRole.VIEWER)}</option>
                                </select>
                              )
                            },
                            {
                              key: 'status',
                              label: 'Status',
                              render: (_, row) => (
                                <Badge variant={getStatusVariant(row.status)}>
                                  {getStatusLabel(row.status)}
                                </Badge>
                              )
                            },
                            {
                              key: 'createdAt',
                              label: 'Data',
                              render: (_, row) => new Date(row.createdAt).toLocaleDateString('pt-BR')
                            },
                            {
                              key: 'actions',
                              label: 'Ações',
                              render: (_, row) => (
                                row.status === 'ACTIVE' ? (
                                  <button
                                    onClick={() => handleRemoveMember(row.id)}
                                    className="text-sm text-error-600 hover:text-error-900 font-medium"
                                    aria-label={`Remover ${row.user?.name || 'membro'}`}
                                  >
                                    Remover
                                  </button>
                                ) : null
                              )
                            }
                          ]}
                          data={teamMembers}
                          caption="Membros da equipe do evento"
                        />
                      </div>

                      {/* Mobile Card Layout */}
                      <div className="md:hidden">
                        <div className="divide-y divide-neutral-200">
                          {teamMembers.map((member) => (
                            <div key={member.id} className="p-4 space-y-4">
                              {/* Member Info */}
                              <div className="flex items-start gap-3">
                                <div className="h-12 w-12 flex-shrink-0">
                                  <div className="h-12 w-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg">
                                    {getMemberInitials(member.user?.name, member.user?.email || member.id)}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-base font-medium text-neutral-900">
                                    {member.user?.name || 'Pendente'}
                                  </div>
                                  <div className="text-sm text-neutral-600">
                                    {member.user?.email || member.id}
                                  </div>
                                </div>
                              </div>

                              {/* Role and Status */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                                    Cargo
                                  </label>
                                  <select
                                    value={member.role}
                                    onChange={(e) =>
                                      handleUpdateRole(member.id, e.target.value as TeamRole)
                                    }
                                    className="w-full text-sm border border-neutral-300 rounded-xl focus:ring-primary-500 focus:border-primary-500 px-2 py-2"
                                    aria-label={`Alterar cargo de ${member.user?.name || 'membro'}`}
                                  >
                                    <option value={TeamRole.ADMIN}>{getRoleLabel(TeamRole.ADMIN)}</option>
                                    <option value={TeamRole.EDITOR}>{getRoleLabel(TeamRole.EDITOR)}</option>
                                    <option value={TeamRole.VIEWER}>{getRoleLabel(TeamRole.VIEWER)}</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                                    Status
                                  </label>
                                  <div>
                                    <Badge variant={getStatusVariant(member.status)}>
                                      {getStatusLabel(member.status)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              {/* Date and Actions */}
                              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                                <div className="text-xs text-neutral-600">
                                  Adicionado em {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                                </div>
                                {member.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="text-sm text-error-600 hover:text-error-900 font-medium"
                                    aria-label={`Remover ${member.user?.name || 'membro'}`}
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            },
            {
              id: 'logs',
              label: 'Logs de Atividade',
              content: (
                <div className="bg-white rounded-2xl shadow-card border border-neutral-200 -mx-4 -my-4">
                  {loadingLogs ? (
                    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                      <span className="sr-only">Carregando logs de atividade...</span>
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-2">📋</div>
                      <p className="text-lg font-medium text-neutral-900 mb-1">
                        Nenhuma atividade registrada
                      </p>
                      <p className="text-sm text-neutral-600">
                        As ações dos membros da equipe aparecerão aqui
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block">
                        <Table
                          columns={[
                            {
                              key: 'action',
                              label: 'Ação',
                              render: (_, row) => (
                                <Badge variant={getActionVariant(row.action)}>
                                  {getActionLabel(row.action)}
                                </Badge>
                              )
                            },
                            {
                              key: 'member',
                              label: 'Membro',
                              render: (_, row) => (
                                <div>
                                  <div className="text-sm font-medium text-neutral-900">
                                    {row.teamMember?.user?.name || 'Membro removido'}
                                  </div>
                                  <div className="text-sm text-neutral-600">
                                    {row.teamMember?.user?.email}
                                  </div>
                                </div>
                              )
                            },
                            {
                              key: 'details',
                              label: 'Detalhes',
                              render: (_, row) => row.details || '-'
                            },
                            {
                              key: 'createdAt',
                              label: 'Data/Hora',
                              render: (_, row) => {
                                const date = new Date(row.createdAt)
                                return (
                                  <div>
                                    <div className="text-sm text-neutral-900">
                                      {date.toLocaleDateString('pt-BR')}
                                    </div>
                                    <div className="text-xs text-neutral-600">
                                      {date.toLocaleTimeString('pt-BR')}
                                    </div>
                                  </div>
                                )
                              }
                            }
                          ]}
                          data={activityLogs}
                          caption="Histórico de atividades da equipe"
                        />
                      </div>

                      {/* Mobile Card Layout */}
                      <div className="md:hidden">
                        <div className="divide-y divide-neutral-200">
                          {activityLogs.map((log) => (
                            <div key={log.id} className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <Badge variant={getActionVariant(log.action)}>
                                  {getActionLabel(log.action)}
                                </Badge>
                                <div className="text-xs text-neutral-600">
                                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-neutral-900">
                                  {log.teamMember?.user?.name || 'Membro removido'}
                                </div>
                                <div className="text-sm text-neutral-600">
                                  {log.teamMember?.user?.email}
                                </div>
                              </div>
                              {log.details && (
                                <div className="text-sm text-neutral-600 bg-neutral-50/80 px-3 py-2 rounded-xl">
                                  {log.details}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            }
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </main>

      {showInviteModal && (
        <Modal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false)
            setInviteErrors({})
          }}
          title="Convidar Membro"
        >
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-neutral-700 mb-2">
                Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => handleInviteEmailChange(e.target.value)}
                required
                placeholder="nome@email.com"
                error={inviteErrors.email}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-neutral-700 mb-2">
                Cargo
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={TeamRole.VIEWER}>Visualizador</option>
                <option value={TeamRole.EDITOR}>Editor</option>
                <option value={TeamRole.ADMIN}>Admin</option>
              </select>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-neutral-600">
                  <strong>Admin:</strong> Acesso completo a todas as funcionalidades
                </p>
                <p className="text-xs text-neutral-600">
                  <strong>Editor:</strong> Pode editar eventos e ver análises
                </p>
                <p className="text-xs text-neutral-600">
                  <strong>Visualizador:</strong> Apenas leitura de dados e análises
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setShowInviteModal(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gradient"
              >
                Enviar Convite
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </OrganizerAppShell>
  )
}
