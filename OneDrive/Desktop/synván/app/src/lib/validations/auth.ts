import { z } from 'zod';

/**
 * Brazilian CPF validation schema
 * CPF must have exactly 11 digits
 */
export const cpfSchema = z.string()
  .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
  .optional();

/**
 * Brazilian phone number validation schema
 * Accepts formats: (11) 99999-9999, 11999999999, +55 11 99999-9999
 */
export const phoneSchema = z.string()
  .regex(/^(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}$/, 'Formato de telefone inválido. Use (11) 99999-9999 ou 11999999999')
  .optional();

/**
 * Password strength indicator
 * Returns: 0 (weak), 1 (medium), 2 (strong)
 */
export function getPasswordStrength(password: string): number {
  if (!password) return 0;

  let strength = 0;

  // Length check
  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;

  // Complexity checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  // Normalize to 0-2 scale
  if (strength <= 2) return 0; // weak
  if (strength <= 3) return 1; // medium
  return 2; // strong
}

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(254, 'Email deve ter no máximo 254 caracteres'),
  password: z.string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Register form validation schema
 * Matches backend validation in /api/auth/register
 */
export const registerSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(254, 'Email deve ter no máximo 254 caracteres'),
  password: z.string()
    .min(1, 'Senha é obrigatória')
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(100, 'Senha deve ter no máximo 100 caracteres'),
  confirmPassword: z.string()
    .min(1, 'Confirmação de senha é obrigatória'),
  cpf: cpfSchema,
  phone: phoneSchema
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword']
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

/**
 * Password reset request schema
 */
export const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(254, 'Email deve ter no máximo 254 caracteres')
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
