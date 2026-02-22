'use client'

import { useEffect } from 'react'
import { OrganizerAppShell } from '@/components/layout/app-shell'
import { ErrorState } from '@/components/ui/error-state'
import { useRouter } from 'next/navigation'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Organizer events page error:', error)
  }, [error])

  return (
    <OrganizerAppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorState
          title="Erro ao Carregar Eventos"
          message="Ocorreu um erro ao carregar seus eventos. Tente novamente ou entre em contato com o suporte."
          variant="server"
          onRetry={() => {
            reset()
          }}
          onGoHome={() => router.push('/organizer/dashboard')}
        />
      </div>
    </OrganizerAppShell>
  )
}
