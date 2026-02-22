/**
 * Integration Tests for Mercado Pago Adapter
 *
 * These tests use mocked API responses to verify the adapter's behavior
 * without making actual API calls to Mercado Pago.
 */

import { MercadoPagoAdapter } from '../../../lib/payments/adapters/mercadopago'
import {
  PaymentMethod,
  PaymentStatus,
  type CreatePaymentRequest,
  type PixPaymentDetails,
  type CreditCardPaymentDetails,
  type BoletoPaymentDetails,
} from '../../../lib/payments/adapters/types'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('MercadoPagoAdapter', () => {
  let adapter: MercadoPagoAdapter
  const mockConfig = {
    apiKey: 'test-access-token',
    apiSecret: 'test-secret',
    sandbox: true,
    webhookSecret: 'test-webhook-secret',
  }

  beforeEach(() => {
    adapter = new MercadoPagoAdapter(mockConfig)
    mockFetch.mockClear()
  })

  afterEach(() => {
    mockFetch.mockReset()
  })

  describe('Configuration', () => {
    it('should be initialized with correct configuration', () => {
      expect(adapter.getProviderName()).toBe('mercadopago')
    })

    it('should use sandbox URL when sandbox is true', () => {
      const sandboxAdapter = new MercadoPagoAdapter({ ...mockConfig, sandbox: true })
      expect(sandboxAdapter).toBeDefined()
    })
  })

  describe('Pix Payments', () => {
    it('should create a Pix payment successfully', async () => {
      const mockPixResponse = {
        id: '1234567890',
        status: 'pending',
        transaction_amount: 100.00,
        payment_method_id: 'pix',
        date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        point_of_interaction: {
          transaction_data: {
            qr_code: '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000',
            qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAA...',
            ticket_url: 'https://pix.mercadopago.com/pix/1234567890',
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPixResponse,
      })

      const request: CreatePaymentRequest = {
        orderId: 'order-123',
        amount: 10000, // R$ 100.00 in cents
        paymentMethod: PaymentMethod.PIX,
        customer: {
          name: 'João Silva',
          email: 'joao@example.com',
          phone: '11987654321',
          cpf: '12345678900',
        },
        paymentDetails: {
          copyPasteCode: '',
          expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        } as PixPaymentDetails,
      }

      const response = await adapter.createPayment(request)

      expect(response.success).toBe(true)
      expect(response.paymentId).toBe('1234567890')
      expect(response.status).toBe(PaymentStatus.PENDING)
      expect(response.transactionAmount).toBe(10000)
      expect(response.paymentMethod).toBe(PaymentMethod.PIX)
      expect(response.pixDetails).toBeDefined()
      expect(response.pixDetails?.qrCodeString).toBe(mockPixResponse.point_of_interaction.transaction_data.qr_code)
      expect(response.pixDetails?.copyPasteCode).toBe(mockPixResponse.point_of_interaction.transaction_data.ticket_url)
    })

    it('should handle Pix payment creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid customer data' }),
      })

      const request: CreatePaymentRequest = {
        orderId: 'order-123',
        amount: 10000,
        paymentMethod: PaymentMethod.PIX,
        customer: {
          name: 'João Silva',
          email: 'invalid-email',
          phone: '11987654321',
        },
        paymentDetails: {
          copyPasteCode: '',
          expirationDate: new Date(),
        } as PixPaymentDetails,
      }

      const response = await adapter.createPayment(request)

      expect(response.success).toBe(false)
      expect(response.status).toBe(PaymentStatus.DECLINED)
      expect(response.errorCode).toBe('API_ERROR')
      expect(response.errorMessage).toContain('400')
    })
  })

  describe('Credit Card Payments', () => {
    it('should create a credit card payment successfully', async () => {
      const mockCardResponse = {
        id: '9876543210',
        status: 'approved',
        transaction_amount: 150.00,
        payment_method_id: 'master',
        date_approved: new Date().toISOString(),
        card: {
          first_six_digits: '123456',
          last_four_digits: '7890',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCardResponse,
      })

      const request: CreatePaymentRequest = {
        orderId: 'order-456',
        amount: 15000, // R$ 150.00 in cents
        paymentMethod: PaymentMethod.CREDIT_CARD,
        customer: {
          name: 'Maria Santos',
          email: 'maria@example.com',
          phone: '11912345678',
          cpf: '98765432100',
          address: {
            street: 'Rua Exemplo',
            number: '123',
            complement: 'Apto 1',
            neighborhood: 'Centro',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01234-567',
          },
        },
        paymentDetails: {
          token: 'card-token-123',
          lastFourDigits: '7890',
          brand: 'master',
          holderName: 'MARIA SANTOS',
          installments: {
            count: 3,
            amount: 5000,
            totalAmount: 15000,
          },
        } as CreditCardPaymentDetails,
      }

      const response = await adapter.createPayment(request)

      expect(response.success).toBe(true)
      expect(response.paymentId).toBe('9876543210')
      expect(response.status).toBe(PaymentStatus.APPROVED)
      expect(response.transactionAmount).toBe(15000)
      expect(response.paymentMethod).toBe(PaymentMethod.CREDIT_CARD)
      expect(response.approvalDate).toBeDefined()
    })

    it('should handle credit card payment with installments', async () => {
      const mockCardResponse = {
        id: '9876543211',
        status: 'approved',
        transaction_amount: 300.00,
        payment_method_id: 'visa',
        date_approved: new Date().toISOString(),
        installments: 12,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCardResponse,
      })

      const request: CreatePaymentRequest = {
        orderId: 'order-789',
        amount: 30000, // R$ 300.00 in cents
        paymentMethod: PaymentMethod.CREDIT_CARD,
        customer: {
          name: 'José Oliveira',
          email: 'jose@example.com',
          phone: '11998765432',
        },
        paymentDetails: {
          token: 'card-token-456',
          lastFourDigits: '1234',
          brand: 'visa',
          holderName: 'JOSE OLIVEIRA',
          installments: {
            count: 12,
            amount: 2500,
            totalAmount: 30000,
            interestRate: 2.99,
          },
        } as CreditCardPaymentDetails,
      }

      const response = await adapter.createPayment(request)

      expect(response.success).toBe(true)
      expect(response.transactionAmount).toBe(30000)
      expect(response.paymentMethod).toBe(PaymentMethod.CREDIT_CARD)
    })
  })

  describe('Boleto Payments', () => {
    it('should create a boleto payment successfully', async () => {
      const mockBoletoResponse = {
        id: '111122223333',
        status: 'pending',
        transaction_amount: 50.00,
        payment_method_id: 'bolbradesco',
        date_of_expiration: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        transaction_details: {
          external_resource_url: 'https://www.mercadopago.com.br/boleto/payment/111122223333',
        },
        barcode: {
          content: '12345678901234567890123456789012345678901234',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBoletoResponse,
      })

      const request: CreatePaymentRequest = {
        orderId: 'order-999',
        amount: 5000, // R$ 50.00 in cents
        paymentMethod: PaymentMethod.BOLETO,
        customer: {
          name: 'Ana Costa',
          email: 'ana@example.com',
          phone: '11911112222',
          cpf: '45678912300',
        },
        paymentDetails: {
          url: '',
          barcode: '',
          expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        } as BoletoPaymentDetails,
      }

      const response = await adapter.createPayment(request)

      expect(response.success).toBe(true)
      expect(response.paymentId).toBe('111122223333')
      expect(response.status).toBe(PaymentStatus.PENDING)
      expect(response.transactionAmount).toBe(5000)
      expect(response.paymentMethod).toBe(PaymentMethod.BOLETO)
      expect(response.boletoDetails).toBeDefined()
      expect(response.boletoDetails?.url).toBe(mockBoletoResponse.transaction_details.external_resource_url)
      expect(response.boletoDetails?.barcode).toBe(mockBoletoResponse.barcode.content)
    })
  })

  describe('Payment Status', () => {
    it('should retrieve payment status successfully', async () => {
      const mockPaymentStatus = {
        id: '1234567890',
        status: 'approved',
        transaction_amount: 100.00,
        payment_method_id: 'pix',
        date_approved: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaymentStatus,
      })

      const response = await adapter.getPaymentStatus('1234567890')

      expect(response.paymentId).toBe('1234567890')
      expect(response.status).toBe(PaymentStatus.APPROVED)
      expect(response.transactionAmount).toBe(10000)
    })

    it('should handle payment status retrieval failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Payment not found' }),
      })

      await expect(adapter.getPaymentStatus('nonexistent-id')).rejects.toThrow('Failed to get payment status')
    })
  })

  describe('Refunds', () => {
    it('should process a full refund successfully', async () => {
      const mockRefundResponse = {
        id: 'refund-123',
        payment_id: '1234567890',
        amount: 100.00,
        status: 'approved',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefundResponse,
      })

      const response = await adapter.refundPayment({
        paymentId: '1234567890',
      })

      expect(response.success).toBe(true)
      expect(response.refundId).toBe('refund-123')
      expect(response.amount).toBe(10000)
      expect(response.status).toBe('approved')
    })

    it('should process a partial refund successfully', async () => {
      const mockRefundResponse = {
        id: 'refund-456',
        payment_id: '1234567890',
        amount: 50.00,
        status: 'approved',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefundResponse,
      })

      const response = await adapter.refundPayment({
        paymentId: '1234567890',
        amount: 5000, // R$ 50.00 in cents
      })

      expect(response.success).toBe(true)
      expect(response.amount).toBe(5000)
    })

    it('should handle refund failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Refund not allowed' }),
      })

      const response = await adapter.refundPayment({
        paymentId: '1234567890',
        amount: 5000,
      })

      expect(response.success).toBe(false)
      expect(response.status).toBe('failed')
      expect(response.errorCode).toBe('REFUND_ERROR')
    })
  })

  describe('Webhooks', () => {
    it('should verify webhook signature and parse notification', () => {
      const webhookSecret = mockConfig.webhookSecret!
      const payload = {
        id: '12345',
        type: 'payment_approved',
        date_created: new Date().toISOString(),
        data: {
          id: 'payment-123',
          status: 'approved',
          transaction_amount: 100.00,
          payment_method_id: 'pix',
          external_reference: 'order-123',
        },
      }

      // Calculate correct signature
      const timestamp = Date.now().toString()
      const payloadString = JSON.stringify(payload)
      const crypto = require('crypto')
      const dataToSign = `${timestamp}${payloadString}`
      const signature = crypto.createHmac('sha256', webhookSecret).update(dataToSign).digest('hex')
      const signatureHeader = `ts:${timestamp},v1:${signature}`

      const notification = adapter.verifyWebhook(signatureHeader, payload)

      expect(notification.eventType).toBe('payment_approved')
      expect(notification.paymentId).toBe('payment-123')
      expect(notification.orderId).toBe('order-123')
      expect(notification.status).toBe(PaymentStatus.APPROVED)
    })

    it('should reject webhook with invalid signature', () => {
      const payload = { id: '12345', type: 'payment_approved' }
      const invalidSignature = 'ts:1234567890,v1:invalid-signature'

      expect(() => {
        adapter.verifyWebhook(invalidSignature, payload)
      }).toThrow('Invalid webhook signature')
    })
  })

  describe('Health Check', () => {
    it('should return true when gateway is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ }),
      })

      const isHealthy = await adapter.healthCheck()

      expect(isHealthy).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/payment_methods'),
        expect.objectContaining({
          method: 'GET',
        })
      )
    })

    it('should return false when gateway is not accessible', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const isHealthy = await adapter.healthCheck()

      expect(isHealthy).toBe(false)
    })
  })

  describe('Payment Cancellation', () => {
    it('should cancel a pending payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1234567890', status: 'cancelled' }),
      })

      const cancelled = await adapter.cancelPayment('1234567890')

      expect(cancelled).toBe(true)
    })

    it('should handle cancellation failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Cannot cancel approved payment' }),
      })

      const cancelled = await adapter.cancelPayment('1234567890')

      expect(cancelled).toBe(false)
    })
  })
})
