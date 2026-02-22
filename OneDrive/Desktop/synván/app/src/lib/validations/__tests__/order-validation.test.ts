/**
 * Tests for Input Validation
 *
 * These tests verify that input validation properly rejects malformed and oversized data:
 * - Order validation enforces max length constraints
 * - Registration validation enforces max length constraints
 * - Brazilian phone format validation
 * - CPF format validation
 */

import { z } from 'zod'
import {
  cartItemSchema,
  createOrderSchema,
  updateOrderSchema,
  applyPromocodeSchema,
} from '../order'

describe('Order Validation - Max Length Constraints', () => {
  describe('cartItemSchema', () => {
    it('should reject quantity exceeding maximum', () => {
      const result = cartItemSchema.safeParse({
        lotId: 'clm1234567890abcdef1234567890',
        quantity: 1001, // Exceeds max of 1000
        ticketType: 'GENERAL',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Quantidade máxima é 1000')
      }
    })

    it('reject quantity of zero', () => {
      const result = cartItemSchema.safeParse({
        lotId: 'clm1234567890abcdef1234567890',
        quantity: 0,
        ticketType: 'GENERAL',
      })

      expect(result.success).toBe(false)
    })

    it('should reject seat array exceeding maximum', () => {
      const tooManySeats = Array.from({ length: 101 }, (_, i) => `clm1234567890abcdefghij${i.toString().padStart(10, '0')}`)
      const result = cartItemSchema.safeParse({
        lotId: 'clm1234567890abcdef1234567890',
        quantity: 10,
        ticketType: 'GENERAL',
        seatIds: tooManySeats,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have validation error about array length
        const hasArrayError = result.error.issues.some(issue =>
          issue.message.includes('Máximo de 100 assentos') ||
          issue.message.includes('maximum')
        )
        expect(hasArrayError).toBe(true)
      }
    })

    it('should accept valid cart item', () => {
      const result = cartItemSchema.safeParse({
        lotId: 'clm1234567890abcdef1234567890',
        quantity: 2,
        ticketType: 'GENERAL',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('createOrderSchema', () => {
    it('should reject items array exceeding maximum', () => {
      const tooManyItems = Array.from({ length: 51 }, (_, i) => ({
        lotId: `clm1234567890abcdefghij${i.toString().padStart(10, '0')}`,
        quantity: 1,
        ticketType: 'GENERAL' as const,
      }))

      const result = createOrderSchema.safeParse({
        eventId: 'clm1234567890abcdef1234567890',
        items: tooManyItems,
        paymentMethod: 'CREDIT_CARD',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have validation error about array length
        const hasArrayError = result.error.issues.some(issue =>
          issue.message.includes('Máximo de 50 itens') ||
          issue.message.includes('maximum')
        )
        expect(hasArrayError).toBe(true)
      }
    })

    it('should reject empty items array', () => {
      const result = createOrderSchema.safeParse({
        eventId: 'clm1234567890abcdef1234567890',
        items: [],
        paymentMethod: 'CREDIT_CARD',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('ao menos um item')
      }
    })

    it('should reject promocode exceeding maximum length', () => {
      const result = createOrderSchema.safeParse({
        eventId: 'clm1234567890abcdef1234567890',
        items: [
          {
            lotId: 'clm1234567890abcdef1234567890',
            quantity: 1,
            ticketType: 'GENERAL',
          },
        ],
        paymentMethod: 'CREDIT_CARD',
        promocode: 'A'.repeat(51), // Exceeds max of 50
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('no máximo 50 caracteres')
      }
    })

    it('should reject installments exceeding maximum', () => {
      const result = createOrderSchema.safeParse({
        eventId: 'clm1234567890abcdef1234567890',
        items: [
          {
            lotId: 'clm1234567890abcdef1234567890',
            quantity: 1,
            ticketType: 'GENERAL',
          },
        ],
        paymentMethod: 'CREDIT_CARD',
        installments: 11, // Exceeds max of 10
      })

      expect(result.success).toBe(false)
    })

    it('should accept valid order', () => {
      const result = createOrderSchema.safeParse({
        eventId: 'clm1234567890abcdef1234567890',
        items: [
          {
            lotId: 'clm1234567890abcdef1234567890',
            quantity: 2,
            ticketType: 'GENERAL',
          },
        ],
        paymentMethod: 'CREDIT_CARD',
        installments: 3,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('applyPromocodeSchema', () => {
    it('should reject promocode exceeding maximum length', () => {
      const result = applyPromocodeSchema.safeParse({
        code: 'A'.repeat(51), // Exceeds max of 50
        eventId: 'clm1234567890abcdef1234567890',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('no máximo 50 caracteres')
      }
    })

    it('should reject empty promocode', () => {
      const result = applyPromocodeSchema.safeParse({
        code: '',
        eventId: 'clm1234567890abcdef1234567890',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('é obrigatório')
      }
    })

    it('should accept valid promocode', () => {
      const result = applyPromocodeSchema.safeParse({
        code: 'PROMO20',
        eventId: 'clm1234567890abcdef1234567890',
      })

      expect(result.success).toBe(true)
    })
  })
})

describe('Registration Validation - Brazilian Format', () => {
  const registerSchema = z.object({
    email: z.string().email('Email inválido').max(254, 'Email deve ter no máximo 254 caracteres'),
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100, 'Senha deve ter no máximo 100 caracteres'),
    cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos').optional(),
    phone: z.string().regex(/^(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}$/, 'Formato de telefone inválido').optional()
  })

  describe('Email Validation', () => {
    it('should reject invalid email format', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        name: 'Test User',
        password: 'password123',
      })

      expect(result.success).toBe(false)
    })

    it('should reject email exceeding max length', () => {
      const result = registerSchema.safeParse({
        email: `${'a'.repeat(245)}@example.com`, // Total 260 chars
        name: 'Test User',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('no máximo 254 caracteres')
      }
    })

    it('should accept valid email', () => {
      const result = registerSchema.safeParse({
        email: 'user@example.com',
        name: 'Test User',
        password: 'password123',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('Name Validation', () => {
    it('should reject name exceeding max length', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'A'.repeat(101), // Exceeds max of 100
        password: 'password123',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('no máximo 100 caracteres')
      }
    })

    it('should reject name below min length', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'AB', // Below min of 3
        password: 'password123',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('Password Validation', () => {
    it('should reject password exceeding max length', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'A'.repeat(101), // Exceeds max of 100
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('no máximo 100 caracteres')
      }
    })

    it('should reject password below min length', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: '12345', // Below min of 6
      })

      expect(result.success).toBe(false)
    })
  })

  describe('CPF Validation', () => {
    it('should accept valid CPF format (11 digits)', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        cpf: '12345678901',
      })

      expect(result.success).toBe(true)
    })

    it('should reject CPF with non-numeric characters', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        cpf: '123.456.789-01', // Formatted CPF should be rejected
      })

      expect(result.success).toBe(false)
    })

    it('should reject CPF with incorrect length', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        cpf: '1234567890', // Only 10 digits
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('11 dígitos')
      }
    })
  })

  describe('Phone Validation - Brazilian Format', () => {
    it('should accept phone with area code and 9 digits: (11) 99999-9999', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        phone: '(11) 99999-9999',
      })

      expect(result.success).toBe(true)
    })

    it('should accept phone with area code and 8 digits: (11) 9999-9999', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        phone: '(11) 9999-9999',
      })

      expect(result.success).toBe(true)
    })

    it('should accept phone without formatting: 11999999999', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        phone: '11999999999',
      })

      expect(result.success).toBe(true)
    })

    it('should accept phone with country code: +55 11 99999-9999', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        phone: '+55 11 99999-9999',
      })

      expect(result.success).toBe(true)
    })

    it('should reject phone with invalid format', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        phone: '123-456-7890', // US format
      })

      expect(result.success).toBe(false)
    })

    it('should reject phone with too few digits', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        phone: '1199999', // Too short
      })

      expect(result.success).toBe(false)
    })

    it('should accept missing phone (optional field)', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      })

      expect(result.success).toBe(true)
    })
  })
})
