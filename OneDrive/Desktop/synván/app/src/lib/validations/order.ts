import { z } from 'zod'

export const cartItemSchema = z.object({
  lotId: z.string().cuid('ID do lote inválido'),
  quantity: z.number().int().positive('Quantidade deve ser positiva').max(1000, 'Quantidade máxima é 1000'),
  ticketType: z.enum(['GENERAL', 'MEIA_ENTRADA', 'VIP', 'EARLY_BIRD']),
  eligibility: z.enum(['STUDENT', 'DISABLED', 'YOUTH', 'ELDERLY']).optional(),
  seatIds: z.array(z.string().cuid('ID do assento inválido')).max(100, 'Máximo de 100 assentos por pedido').optional(),
})

export type CartItem = z.infer<typeof cartItemSchema>

export const createOrderSchema = z.object({
  eventId: z.string().cuid('ID do evento inválido'),
  items: z.array(cartItemSchema).min(1, 'Carrinho deve ter ao menos um item').max(50, 'Máximo de 50 itens por pedido'),
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'APPLE_PAY', 'GOOGLE_PAY']),
  installments: z.number().int().min(1).max(10).optional().default(1),
  promocode: z.string().max(50, 'Código promocional deve ter no máximo 50 caracteres').optional(),
  feeAllocation: z.enum(['ORGANIZER', 'BUYER']).optional().default('BUYER'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

export const updateOrderSchema = z.object({
  paymentMethod: z.enum(['CREDIT_CARD', 'PIX', 'BOLETO', 'APPLE_PAY', 'GOOGLE_PAY']).optional(),
  paymentStatus: z.enum(['PENDING', 'APPROVED', 'REFUSED', 'REFUNDED']).optional(),
})

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>

export const applyPromocodeSchema = z.object({
  code: z.string().min(1, 'Código do cupom é obrigatório').max(50, 'Código do cupom deve ter no máximo 50 caracteres'),
  eventId: z.string().cuid('ID do evento inválido'),
})

export type ApplyPromocodeInput = z.infer<typeof applyPromocodeSchema>
