import { z } from 'zod'

/**
 * Team member invite validation schema
 * Matches backend validation in /api/team-members
 */
export const inviteSchema = z.object({
  email: z.string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(254, 'Email deve ter no máximo 254 caracteres'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'], {
    message: 'Cargo deve ser ADMIN, MEMBER ou VIEWER'
  })
})

export type InviteFormValues = z.infer<typeof inviteSchema>

/**
 * Certificate verification code validation schema
 * Certificate codes are typically alphanumeric, 12-16 characters
 */
export const certificateVerifySchema = z.object({
  code: z.string()
    .min(1, 'Código de verificação é obrigatório')
    .min(8, 'Código deve ter pelo menos 8 caracteres')
    .max(32, 'Código deve ter no máximo 32 caracteres')
    .regex(/^[A-Z0-9]+$/, 'Código deve conter apenas letras maiúsculas e números')
})

export type CertificateVerifyFormValues = z.infer<typeof certificateVerifySchema>
