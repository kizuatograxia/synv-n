'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import Link from 'next/link'
import { CheckCircle, XCircle, Search, Award, Calendar, User, Building2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { certificateVerifySchema, type CertificateVerifyFormValues } from '@/lib/validations/team'

interface CertificateData {
  attendeeName: string
  eventName: string
  eventDate: string
  verificationCode: string
  organizer: string
}

interface VerificationResult {
  valid: boolean
  message?: string
  certificate?: CertificateData
}

function CertificateVerifyContent() {
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')

  const [verificationCode, setVerificationCode] = useState(codeFromUrl || '')
  const [codeError, setCodeError] = useState('')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(!!codeFromUrl)

  useEffect(() => {
    if (codeFromUrl) {
      verifyCertificate(codeFromUrl)
    }
  }, [codeFromUrl])

  const verifyCertificate = async (code: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/certificates/verify?code=${code.trim()}`)
      const data = await response.json()
      setResult(data)
      setSearched(true)
    } catch (err: any) {
      console.error('Error verifying certificate:', err)
      setResult({
        valid: false,
        message: 'Erro ao verificar certificado. Tente novamente.',
      })
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError('')

    // Client-side validation using Zod schema
    try {
      certificateVerifySchema.parse({ code: verificationCode })
      setCodeError('')
      verifyCertificate(verificationCode)
    } catch (err) {
      if (err instanceof z.ZodError) {
        setCodeError(err.issues[0].message || 'Código inválido')
      }
    }
  }

  const handleCodeChange = (value: string) => {
    const upperValue = value.toUpperCase()
    setVerificationCode(upperValue)
    // Clear error when user types
    if (codeError) {
      setCodeError('')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-display font-bold text-neutral-900">
            Verificação de Certificado
          </h1>
          <p className="mt-2 text-neutral-600">
            Insira o código de verificação para validar a autenticidade do certificado
          </p>
        </div>

        <Card padding="lg" className="mb-8">
          <CardHeader>
            <CardTitle>Verificar Certificado</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-neutral-700 mb-2">
                  Código de Verificação
                </label>
                <Input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Ex: ABC123DEF456"
                  error={codeError}
                  className="font-mono"
                  aria-label="Código de verificação do certificado"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  variant="gradient"
                  disabled={loading || !verificationCode.trim()}
                  className="flex-1"
                >
                  <Search className="h-[1rem] w-[1rem] mr-2" />
                  Verificar
                </Button>
                <Link href="/certificates" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Meus Certificados
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
            <LoadingSpinner />
            <span className="sr-only">Verificando certificado...</span>
          </div>
        )}

        {searched && result && !loading && (
          <div className="space-y-8">
            {result.valid && result.certificate ? (
              <Card padding="lg" className="border-2 border-success-200 bg-success-50">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-success-600" />
                  </div>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-2xl font-display font-bold text-success-800 mb-2">
                    Certificado Válido
                  </h2>
                  <p className="text-success-700">
                    Este certificado é autêntico e foi emitido pela plataforma.
                  </p>
                </div>

                <div className="bg-white rounded-xl p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Award className="h-5 w-5 text-neutral-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-600 mb-1">Evento</p>
                      <p className="font-semibold text-neutral-900">
                        {result.certificate.eventName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-neutral-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-600 mb-1">Participante</p>
                      <p className="font-semibold text-neutral-900">
                        {result.certificate.attendeeName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-neutral-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-600 mb-1">Data do Evento</p>
                      <p className="font-semibold text-neutral-900">
                        {formatDate(result.certificate.eventDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-neutral-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-600 mb-1">Organizador</p>
                      <p className="font-semibold text-neutral-900">
                        {result.certificate.organizer}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-200">
                    <p className="text-sm text-neutral-600 mb-2">Código de Verificação</p>
                    <code className="px-3 py-2 bg-neutral-100 rounded text-sm font-mono block text-center">
                      {result.certificate.verificationCode}
                    </code>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <Badge variant="success" size="md">
                    <CheckCircle className="h-[1rem] w-[1rem] mr-1" />
                    Verificado em {new Date().toLocaleDateString('pt-BR')}
                  </Badge>
                </div>
              </Card>
            ) : (
              <Card padding="lg" className="border-2 border-error-200 bg-error-50">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-error-100 flex items-center justify-center">
                    <XCircle className="h-10 w-10 text-error-600" />
                  </div>
                </div>

                <div className="text-center">
                  <h2 className="text-2xl font-display font-bold text-error-800 mb-2">
                    Certificado Inválido
                  </h2>
                  <p className="text-error-700 mb-6">
                    {result.message || 'Não foi possível encontrar um certificado com este código.'}
                  </p>

                  <div className="bg-white rounded-xl p-4 text-sm text-neutral-600">
                    <p className="mb-2">Possíveis motivos:</p>
                    <ul className="list-disc list-inside space-y-4 text-left">
                      <li>O código de verificação foi digitado incorretamente</li>
                      <li>O certificado não existe ou foi revogado</li>
                      <li>O código expirou</li>
                    </ul>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null)
                      setSearched(false)
                      setVerificationCode('')
                    }}
                    className="mt-6"
                  >
                    Tentar Novamente
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {!searched && (
          <Card padding="lg" className="bg-primary-50 border-primary-200">
            <h3 className="font-display font-semibold text-primary-900 mb-2">
              Sobre a Verificação
            </h3>
            <p className="text-sm text-primary-800 mb-4">
              Cada certificado emitido possui um código único de verificação. Use este código
              para confirmar a autenticidade do certificado e as informações do participante.
            </p>
            <div className="text-sm text-primary-700">
              <p className="font-medium mb-1">O código de verificação encontra-se:</p>
              <ul className="list-disc list-inside space-y-4">
                <li>No arquivo do certificado (baixado pelo participante)</li>
                <li>Na página &quot;Meus Certificados&quot; do participante</li>
              </ul>
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function CertificateVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LoadingSpinner />
      </div>
    }>
      <CertificateVerifyContent />
    </Suspense>
  )
}
