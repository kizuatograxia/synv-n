'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { PasswordStrength } from '@/components/ui/password-strength'
import { registerSchema, type RegisterFormValues } from '@/lib/validations/auth'
import { formatCPF, stripCPF, formatPhone, stripPhone } from '@/lib/utils/format'
import { Sparkles } from 'lucide-react'

export default function RegisterPage() {
  const [formData, setFormData] = useState<Partial<RegisterFormValues>>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    cpf: '',
    phone: ''
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({})
  const [error, setError] = useState('')
  const [loading, setIsLoading] = useState(false)

  const handleFieldChange = (field: keyof RegisterFormValues) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value)
    handleFieldChange('cpf')(formatted)
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value)
    handleFieldChange('phone')(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrors({})

    try {
      const dataToValidate = {
        ...formData,
        cpf: formData.cpf ? stripCPF(formData.cpf) : '',
        phone: formData.phone ? stripPhone(formData.phone) : ''
      }
      registerSchema.parse(dataToValidate)
    } catch (err) {
      if (err instanceof Error && 'issues' in err) {
        const fieldErrors: Partial<Record<keyof RegisterFormValues, string>> = {}
        // @ts-ignore - ZodError has issues property
        err.issues.forEach((issue: any) => {
          const field = issue.path[0] as keyof RegisterFormValues
          fieldErrors[field] = issue.message
        })
        setErrors(fieldErrors)
      }
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          cpf: formData.cpf ? stripCPF(formData.cpf) : undefined,
          phone: formData.phone ? stripPhone(formData.phone) : undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.details) {
          const fieldErrors: Partial<Record<keyof RegisterFormValues, string>> = {}
          data.details.forEach((detail: any) => {
            const field = detail.path[0] as keyof RegisterFormValues
            fieldErrors[field] = detail.message
          })
          setErrors(fieldErrors)
        } else {
          setError(data.error || 'Erro ao criar conta')
        }
        setIsLoading(false)
        return
      }

      window.location.href = '/auth/login?registered=true'
    } catch (err) {
      setError('Erro ao criar conta')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="flex items-center justify-center py-12 px-4 sm:py-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden rounded-2xl shadow-elevated border border-neutral-200/60">
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
                Junte-se a nós
              </h2>
              <p className="text-neutral-500 leading-relaxed max-w-sm">
                Crie sua conta para descobrir eventos, comprar ingressos e gerenciar suas experiências.
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
                <h1 className="text-2xl font-display font-bold text-neutral-900 mb-1">Criar Conta</h1>
                <p className="text-neutral-600">Preencha os dados abaixo</p>
              </div>

              {error && (
                <Alert variant="error" className="mb-6">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FormField
                  name="name"
                  label="Nome completo"
                  type="text"
                  placeholder="João Silva"
                  required
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleFieldChange('name')}
                  error={errors.name}
                  schema={registerSchema.shape.name}
                  validateOnChange={false}
                />

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
                  schema={registerSchema.shape.email}
                  validateOnChange={false}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    name="cpf"
                    label="CPF"
                    type="text"
                    placeholder="000.000.000-00"
                    autoComplete="off"
                    value={formData.cpf}
                    onChange={handleCPFChange}
                    error={errors.cpf}
                    helperText="Opcional"
                  />

                  <FormField
                    name="phone"
                    label="Telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    error={errors.phone}
                    helperText="Opcional"
                  />
                </div>

                <div>
                  <FormField
                    name="password"
                    label="Senha"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    required
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleFieldChange('password')}
                    error={errors.password}
                    schema={registerSchema.shape.password}
                    validateOnChange={false}
                  />
                  <PasswordStrength password={formData.password || ''} />
                </div>

                <FormField
                  name="confirmPassword"
                  label="Confirmar Senha"
                  type="password"
                  placeholder="Repita a senha"
                  required
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleFieldChange('confirmPassword')}
                  error={errors.confirmPassword}
                  validateOnChange={false}
                />

                <Button
                  type="submit"
                  variant="gradient"
                  fullWidth
                  loading={loading}
                  size="lg"
                >
                  Criar Conta
                </Button>
              </form>

              <div className="mt-8 text-center text-sm text-neutral-600">
                Já tem uma conta?{' '}
                <Link
                  href="/auth/login"
                  className="font-semibold text-primary-600 hover:text-primary-700"
                >
                  Entre
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
