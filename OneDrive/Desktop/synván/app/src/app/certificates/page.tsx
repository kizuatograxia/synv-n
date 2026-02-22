'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Calendar, Download, Award, ExternalLink } from 'lucide-react'
import { AuthenticatedAppShell } from '@/components/layout/app-shell'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Badge } from '@/components/ui/badge'
import { ErrorState, getErrorVariantFromStatus, getErrorMessageFromError } from '@/components/ui/error-state'
import { useToast } from '@/hooks/useToast'
import type { ApiError } from '@/hooks/useApi'

interface CertificateEvent {
  id: string
  title: string
  startTime: string
  location: string
  imageUrl?: string
}

interface CertificateOrder {
  id: string
  createdAt: string
}

interface Certificate {
  id: string
  attendeeName: string
  eventName: string
  eventDate: string
  verificationCode: string
  downloadedAt: string | null
  createdAt: string
  event: CertificateEvent
  order: CertificateOrder
}

export default function CertificatesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (session?.user) {
      fetchCertificates()
    }
  }, [session])

  const fetchCertificates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/certificates/my-certificates')

      if (!response.ok) {
        const data = await response.json()
        const apiError: ApiError = {
          message: data.error || data.message || 'Falha ao buscar certificados',
          status: response.status,
          code: data.code
        }
        setError(apiError)
        return
      }

      const data = await response.json()
      setCertificates(data.certificates || [])
    } catch (err: any) {
      const apiError: ApiError = {
        message: 'Erro de conexão. Verifique sua internet e tente novamente.',
        status: undefined
      }
      setError(apiError)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (certificateId: string, eventName: string) => {
    setDownloadingId(certificateId)
    try {
      const response = await fetch(`/api/certificates/${certificateId}`)

      if (!response.ok) {
        throw new Error('Falha ao baixar certificado')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `certificado-${certificateId}.html`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Certificado baixado com sucesso!')

      // Refresh to show download status
      fetchCertificates()
    } catch (err: any) {
      console.error('Error downloading certificate:', err)
      toast.error(err.message || 'Falha ao baixar certificado')
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const getVerificationUrl = (code: string) => {
    return `${window.location.origin}/certificates/verify?code=${code}`
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-card p-8 text-center max-w-md">
          <h1 className="text-2xl font-display font-bold text-neutral-900 mb-4">Acesso Negado</h1>
          <p className="text-neutral-600 mb-6">Você precisa estar logado para ver seus certificados.</p>
          <Button onClick={() => router.push('/auth/login')} variant="gradient">
            Fazer Login
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AuthenticatedAppShell>
        <main className="space-y-8">
          <div className="flex justify-center py-12" role="status" aria-live="polite">
            <LoadingSpinner />
            <span className="sr-only">Carregando certificados...</span>
          </div>
        </main>
      </AuthenticatedAppShell>
    )
  }

  return (
    <AuthenticatedAppShell>
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-neutral-900">Meus Certificados</h1>
          <p className="mt-2 text-neutral-600">
            Certificados de participação em eventos que você frequentou
          </p>
        </div>

        {error && (
          <ErrorState
            title="Erro ao Carregar Certificados"
            message={getErrorMessageFromError(error)}
            variant={getErrorVariantFromStatus(error.status)}
            onRetry={() => fetchCertificates()}
          />
        )}

        {!error && certificates.length === 0 ? (
          <EmptyState
            icon={<Award className="w-16 h-16" />}
            title="Nenhum certificado encontrado"
            description="Você ainda não possui certificados. Participe de eventos para ganhar certificados de participação."
            action={{
              label: 'Explorar Eventos',
              onClick: () => router.push('/events'),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((certificate) => (
              <article key={certificate.id}>
                <Card className="h-full flex flex-col" hover>
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">
                      {certificate.eventName}
                    </CardTitle>
                    <CardContent className="text-sm text-neutral-600 mt-2 space-y-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-[1rem] h-[1rem] text-neutral-600 flex-shrink-0" />
                        <time dateTime={certificate.eventDate}>
                          {formatDate(certificate.eventDate)}
                        </time>
                      </div>
                      {certificate.event.location && (
                        <div className="line-clamp-1">
                          {certificate.event.location}
                        </div>
                      )}
                    </CardContent>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col justify-end space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600">Emitido em:</span>
                        <span className="font-medium text-neutral-900">
                          {formatDate(certificate.createdAt)}
                        </span>
                      </div>
                      {certificate.downloadedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600">Baixado em:</span>
                          <span className="font-medium text-neutral-900">
                            {formatDate(certificate.downloadedAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleDownload(certificate.id, certificate.eventName)}
                        disabled={downloadingId === certificate.id}
                        variant="gradient"
                        className="w-full"
                        aria-label={`Baixar certificado de ${certificate.eventName}`}
                      >
                        {downloadingId === certificate.id ? (
                          <>
                            <LoadingSpinner size="sm" className="mr-2" />
                            Baixando...
                          </>
                        ) : (
                          <>
                            <Download className="w-[1rem] h-[1rem] mr-2" />
                            Baixar Certificado
                          </>
                        )}
                      </Button>

                      <Link
                        href={getVerificationUrl(certificate.verificationCode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          aria-label="Verificar autenticidade do certificado"
                        >
                          <ExternalLink className="w-[1rem] h-[1rem] mr-2" />
                          Verificar Autenticidade
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </article>
            ))}
          </div>
        )}
      </main>
    </AuthenticatedAppShell>
  )
}
