'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, Home, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  title?: string
  message: string
  variant?: 'network' | 'not-found' | 'permission' | 'server' | 'general'
  onRetry?: () => void
  onGoHome?: () => void
  onGoBack?: () => void
  className?: string
}

export function ErrorState({
  title,
  message,
  variant = 'general',
  onRetry,
  onGoHome,
  onGoBack,
  className
}: ErrorStateProps) {
  const getVariantInfo = () => {
    switch (variant) {
      case 'network':
        return {
          title: title || 'Erro de Conexão',
          description: message,
          iconBg: 'bg-warning-50',
          iconColor: 'text-warning-600',
        }
      case 'not-found':
        return {
          title: title || 'Não Encontrado',
          description: message,
          iconBg: 'bg-neutral-100',
          iconColor: 'text-neutral-600',
        }
      case 'permission':
        return {
          title: title || 'Sem Permissão',
          description: message,
          iconBg: 'bg-error-50',
          iconColor: 'text-error-600',
        }
      case 'server':
        return {
          title: title || 'Erro no Servidor',
          description: message,
          iconBg: 'bg-error-50',
          iconColor: 'text-error-600',
        }
      default:
        return {
          title: title || 'Erro',
          description: message,
          iconBg: 'bg-error-50',
          iconColor: 'text-error-600',
        }
    }
  }

  const info = getVariantInfo()

  return (
    <div
      className={cn('bg-white rounded-2xl border border-neutral-200/60 shadow-card p-8', className)}
      role="alert"
      aria-live="polite"
    >
      <div className="flex flex-col items-center text-center space-y-6">
        <div className={cn('rounded-2xl p-4', info.iconBg)}>
          <AlertCircle className={cn('w-12 h-12', info.iconColor)} />
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-display font-semibold text-neutral-900">
            {info.title}
          </h2>
          <p className="text-neutral-600">
            {info.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {onRetry && (
            <Button
              variant="gradient"
              onClick={onRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-[1rem] h-[1rem]" />
              Tentar Novamente
            </Button>
          )}
          {onGoBack && (
            <Button
              variant="outline"
              onClick={onGoBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-[1rem] h-[1rem]" />
              Voltar
            </Button>
          )}
          {onGoHome && (
            <Button
              variant="outline"
              onClick={onGoHome}
              className="flex items-center gap-2"
            >
              <Home className="w-[1rem] h-[1rem]" />
              Ir para Home
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function getErrorVariantFromStatus(status?: number): ErrorStateProps['variant'] {
  if (!status) return 'general'

  if (status >= 400 && status < 500) {
    if (status === 404) return 'not-found'
    if (status === 403 || status === 401) return 'permission'
    return 'general'
  }

  if (status >= 500) return 'server'

  return 'network'
}

export function getErrorMessageFromError(
  error: { message?: string; status?: number; code?: string } | null,
  fallbackMessage = 'Ocorreu um erro inesperado. Tente novamente.'
): string {
  if (!error) return fallbackMessage

  if (error.message) return error.message

  if (error.status === 404) return 'O recurso solicitado não foi encontrado.'
  if (error.status === 403) return 'Você não tem permissão para acessar este recurso.'
  if (error.status === 401) return 'Você precisa estar autenticado para acessar este recurso.'
  if (error.status === 500) return 'O servidor encontrou um erro. Tente novamente mais tarde.'
  if (error.status && error.status >= 400 && error.status < 500) {
    return 'Ocorreu um erro com sua solicitação. Verifique os dados e tente novamente.'
  }

  return fallbackMessage
}
