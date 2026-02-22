'use client'

import { useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Event management error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error-600" />
        </div>
        <h1 className="text-2xl font-display font-bold text-neutral-900 mb-2">
          Erro ao Gerenciar Evento
        </h1>
        <p className="text-neutral-600 mb-6">
          Ocorreu um erro ao carregar a página de gerenciamento. Por favor, tente novamente.
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={reset}
          >
            Tentar Novamente
          </Button>
          <Button
            variant="primary"
            onClick={() => window.location.href = '/organizer/events'}
          >
            Voltar para Meus Eventos
          </Button>
        </div>
      </Card>
    </div>
  )
}
