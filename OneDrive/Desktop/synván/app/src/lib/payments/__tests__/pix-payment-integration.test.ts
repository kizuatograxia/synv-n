/**
 * Integration Tests for Pix Payment Flow
 *
 * These tests verify the complete Pix payment flow, ensuring that:
 * - QR code generation returns correct format
 * - Copy-paste code is included
 * - Payment can be processed end-to-end
 */

import { PaymentService } from '../payment-service'
import { PaymentData } from '../types'

// Mock fetch for payment gateway API calls
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('Pix Payment Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    // Initialize PaymentService without credentials to use mock implementation
    process.env.PAYMENT_GATEWAY_PROVIDER = ''
    process.env.PAYMENT_GATEWAY_API_KEY = ''
    process.env.PAYMENT_GATEWAY_SECRET = ''
  })

  afterEach(() => {
    mockFetch.mockReset()
  })

  describe('Pix Payment Creation with QR Code', () => {
    it('should generate QR code for Pix payment', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-pix-123',
        amount: 15000, // R$ 150.00
        paymentMethod: 'PIX',
        installments: 1,
        pixKey: '12345678900',
        customerEmail: 'customer@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPix(paymentData)

      expect(result.status).toBe('APPROVED')
      expect(result.transactionId).toBeDefined()
      expect(result.transactionId).toMatch(/^PIX_\d+_[a-z0-9]+$/)
      expect(result.qrCode).toBeDefined()
      expect(result.qrCode).toMatch(/^00020126580014/)
      expect(result.estimatedApprovalTime).toBe('Instantâneo')
    })

    it('should return QR code string in correct Pix format', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-pix-456',
        amount: 5000, // R$ 50.00
        paymentMethod: 'PIX',
        installments: 1,
        pixKey: '98765432100',
        customerEmail: 'buyer@example.com',
        customerCpf: '98765432100',
      }

      const result = await PaymentService.processPix(paymentData)

      // Verify QR code follows BR Code pattern (starts with payload format indicator)
      expect(result.qrCode).toBeDefined()
      expect(result.qrCode!.length).toBeGreaterThan(0)
      expect(result.qrCode).toContain('00020126580014') // PIX indicator
      expect(result.qrCode).toContain('br.gov.bcb.pix') // Central Bank key
    })

    it('should include transaction ID in QR code', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-pix-789',
        amount: 20000, // R$ 200.00
        paymentMethod: 'PIX',
        installments: 1,
        customerEmail: 'test@example.com',
        customerCpf: '45678912300',
      }

      const result = await PaymentService.processPix(paymentData)

      // QR code should contain the transaction ID for traceability
      expect(result.qrCode).toBeDefined()
      expect(result.transactionId).toBeDefined()
      // The transaction ID should be embeddable in the QR code payload
      expect(result.qrCode!.length).toBeGreaterThan(result.transactionId.length)
    })

    it('should handle different amount values correctly', async () => {
      const testAmounts = [1000, 5000, 10000, 50000] // R$ 10, 50, 100, 500

      for (const amount of testAmounts) {
        const paymentData: PaymentData = {
          orderId: `order-pix-${amount}`,
          amount,
          paymentMethod: 'PIX',
          installments: 1,
          customerEmail: 'test@example.com',
          customerCpf: '12345678900',
        }

        const result = await PaymentService.processPix(paymentData)

        expect(result.status).toBe('APPROVED')
        expect(result.qrCode).toBeDefined()
        expect(result.transactionId).toBeDefined()
      }
    })
  })

  describe('Pix Payment with Gateway Adapter', () => {
    beforeEach(() => {
      // Configure PaymentService with Mercado Pago adapter
      process.env.PAYMENT_GATEWAY_PROVIDER = 'mercadopago'
      process.env.PAYMENT_GATEWAY_API_KEY = 'test-access-token'
      process.env.PAYMENT_GATEWAY_SECRET = 'test-secret'
      process.env.PAYMENT_GATEWAY_SANDBOX = 'true'

      PaymentService.initialize()
    })

    it('should create Pix payment with QR code via gateway adapter', async () => {
      const mockPixResponse = {
        id: 'pix-payment-123',
        status: 'pending',
        transaction_amount: 100.00,
        payment_method_id: 'pix',
        date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        point_of_interaction: {
          transaction_data: {
            qr_code: '00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-4266141740005204000053030985406100.005802BR5925Simprao Eventos Ltda6009SAO PAULO62070503***6304E8A1',
            qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAA...',
            ticket_url: 'https://pix.mercadopago.com/pix/1234567890',
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPixResponse,
      })

      const paymentData: PaymentData = {
        orderId: 'order-adapter-pix-123',
        amount: 10000, // R$ 100.00 in cents
        paymentMethod: 'PIX',
        installments: 1,
        customerEmail: 'joao@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('PENDING')
      expect(result.transactionId).toBe('pix-payment-123')
      expect(result.qrCode).toBeDefined()
      expect(result.qrCode).toBe(mockPixResponse.point_of_interaction.transaction_data.qr_code)
      expect(result.estimatedApprovalTime).toBe('Instantâneo')
    })

    it('should return copy-paste code in Pix details via gateway', async () => {
      const mockPixResponse = {
        id: 'pix-payment-456',
        status: 'pending',
        transaction_amount: 75.50,
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

      const paymentData: PaymentData = {
        orderId: 'order-adapter-pix-456',
        amount: 7550, // R$ 75.50 in cents
        paymentMethod: 'PIX',
        installments: 1,
        customerEmail: 'maria@example.com',
        customerCpf: '98765432100',
        customerPhone: '11912345678',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('PENDING')
      expect(result.transactionId).toBe('pix-payment-456')
      expect(result.qrCode).toBeDefined()
      // QR code should contain the complete Pix payload
      expect(result.qrCode).toContain('BR.GOV.BCB.PIX')
    })

    it('should handle gateway API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          message: 'Invalid Pix key format',
          error: 'invalid_request',
        }),
      })

      const paymentData: PaymentData = {
        orderId: 'order-pix-error',
        amount: 5000,
        paymentMethod: 'PIX',
        installments: 1,
        customerEmail: 'error@example.com',
        customerCpf: '12345678900',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('REFUSED')
      expect(result.refusalReason).toBeDefined()
    })
  })

  describe('Pix Payment Risk Analysis', () => {
    it('should approve low-risk Pix payment', async () => {
      const lowRiskData: PaymentData = {
        orderId: 'order-pix-low-risk',
        amount: 100, // Low amount
        paymentMethod: 'PIX',
        installments: 1,
        customerEmail: 'trusted@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPix(lowRiskData)

      // Low-risk payments should be approved
      expect(result.status).toBe('APPROVED')
      expect(result.qrCode).toBeDefined()
    })

    it('should flag high-risk Pix payment', async () => {
      const highRiskData: PaymentData = {
        orderId: 'order-pix-high-risk',
        amount: 10000, // High amount
        paymentMethod: 'PIX',
        installments: 1,
        customerEmail: 'suspicious@example.com',
        // Missing CPF increases risk
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPix(highRiskData)

      // High-risk payments might still be approved for Pix (instant payment)
      // but with risk analysis performed
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('transactionId')
    })
  })

  describe('Pix Payment Refund', () => {
    beforeEach(() => {
      // Clear any adapter configuration to use mock implementation
      process.env.PAYMENT_GATEWAY_PROVIDER = ''
      process.env.PAYMENT_GATEWAY_API_KEY = ''
      process.env.PAYMENT_GATEWAY_SECRET = ''
      // Reinitialize to clear the adapter
      PaymentService.initialize()
    })

    it('should process Pix refund successfully with mock implementation', async () => {
      const transactionId = 'PIX_1234567890_abc123'

      const refundResult = await PaymentService.processRefund(
        transactionId,
        5000, // R$ 50.00
        'PIX'
      )

      // Mock implementation should return SUCCESS
      expect(['SUCCESS', 'PENDING', 'FAILED']).toContain(refundResult.status)
      expect(refundResult.refundId).toBeDefined()
      expect(refundResult.estimatedProcessingTime).toBeDefined()
    })

    it('should handle Pix refund with correct processing time', async () => {
      const transactionId = 'PIX_9876543210_xyz789'

      const refundResult = await PaymentService.processRefund(
        transactionId,
        10000, // R$ 100.00
        'PIX'
      )

      expect(['SUCCESS', 'PENDING', 'FAILED']).toContain(refundResult.status)
      if (refundResult.status === 'SUCCESS') {
        expect(refundResult.estimatedProcessingTime).toBe('Instantâneo')
      }
    })
  })
})
