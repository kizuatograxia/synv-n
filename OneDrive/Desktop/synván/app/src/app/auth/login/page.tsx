'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth'
import { Sparkles } from 'lucide-react'

export default function LoginPage() {
  const [formData, setFormData] = useState<Partial<LoginFormValues>>({
    email: '',
    password: ''
  })
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({})
  const [error, setError] = useState('')
  const [loading, setIsLoading] = useState(false)

  const handleFieldChange = (field: keyof LoginFormValues) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrors({})

    try {
      loginSchema.parse(formData)
    } catch (err) {
      if (err instanceof Error && 'issues' in err) {
        const fieldErrors: Partial<Record<keyof LoginFormValues, string>> = {}
        // @ts-ignore - ZodError has issues property
        err.issues.forEach((issue: any) => {
          const field = issue.path[0] as keyof LoginFormValues
          fieldErrors[field] = issue.message
        })
        setErrors(fieldErrors)
      }
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        setError('Email ou senha inválidos')
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      setError('Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="flex items-center justify-center py-12 px-4 sm:py-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-0 overflow-hidden rounded-2xl shadow-elevated border border-neutral-200/60">
          {/* Brand Panel */}
          <div className="hidden lg:flex gradient-hero relative p-12 flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-52 h-52 bg-secondary-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-neutral-300 text-sm mb-8 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 text-primary-400" />
                Plataforma de Eventos
              </div>
              <h2 className="text-4xl font-display font-extrabold text-white mb-4">
                Bem-vindo de volta
              </h2>
              <p className="text-neutral-500 leading-relaxed max-w-sm">
                Entre na sua conta para acessar seus ingressos, gerenciar eventos e muito mais.
              </p>
            </div>
            <p className="relative text-sm text-neutral-600">
              &copy; {new Date().getFullYear()} Simprão
            </p>
          </div>

          {/* Form Panel */}
          <div className="bg-white p-8 sm:p-12">
            <div className="max-w-sm mx-auto">
              <div className="mb-8">
                <h1 className="text-2xl font-display font-bold text-neutral-900 mb-1">Entrar</h1>
                <p className="text-neutral-600">Acesse sua conta Simprão</p>
              </div>

              {error && (
                <Alert variant="error" className="mb-6">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <FormField
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleFieldChange('email')}
                  error={errors.email}
                  schema={loginSchema.shape.email}
                  validateOnChange={false}
                />

                <div>
                  <FormField
                    name="password"
                    label="Senha"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleFieldChange('password')}
                    error={errors.password}
                    schema={loginSchema.shape.password}
                    validateOnChange={false}
                  />
                  <div className="flex justify-end mt-1.5">
                    <Link
                      href="/auth/forgot-password"
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  fullWidth
                  loading={loading}
                  size="lg"
                >
                  Entrar
                </Button>
              </form>

              <div className="mt-8 text-center text-sm text-neutral-600">
                Não tem uma conta?{' '}
                <Link
                  href="/auth/register"
                  className="font-semibold text-primary-600 hover:text-primary-700"
                >
                  Cadastre-se
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
