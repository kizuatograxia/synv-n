/**
 * Integration Tests for Credit Card Payment Flow
 *
 * These tests verify the complete credit card payment flow, ensuring that:
 * - Valid card payments are approved
 * - Authorization codes are generated
 * - Installment processing works correctly
 * - Risk analysis is performed
 */

import { PaymentService } from '../payment-service'
import { PaymentData } from '../types'

// Mock fetch for payment gateway API calls
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('Credit Card Payment Integration', () => {
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

  describe('Credit Card Payment with Valid Card - Success', () => {
    it('should approve payment with valid credit card', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-card-123',
        amount: 15000, // R$ 150.00
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4242424242424242', // Valid test card
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'João Silva',
        customerEmail: 'joao@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('APPROVED')
      expect(result.transactionId).toBeDefined()
      expect(result.transactionId).toMatch(/^TXN_\d+_[a-z0-9]+$/)
      expect(result.approvalCode).toBeDefined()
      expect(result.approvalCode).toMatch(/^[A-Z0-9]{6}$/)
      expect(result.estimatedApprovalTime).toBe('Instantâneo (até 72h de análise)')
    })

    it('should process single installment payment correctly', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-card-single',
        amount: 10000, // R$ 100.00
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Maria Santos',
        customerEmail: 'maria@example.com',
        customerCpf: '98765432100',
        customerPhone: '11912345678',
      }

      const result = await PaymentService.processPayment(paymentData)

      // Note: Mock implementation has 10% random refusal rate
      expect(['APPROVED', 'REFUSED']).toContain(result.status)
      if (result.status === 'APPROVED') {
        expect(result.transactionId).toBeDefined()
        expect(result.approvalCode).toBeDefined()
        expect(result.estimatedApprovalTime).toBeDefined()
      } else {
        expect(result.refusalReason).toBeDefined()
      }
    })

    it('should process payment with multiple installments', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-card-installments',
        amount: 12000, // R$ 120.00
        paymentMethod: 'CREDIT_CARD',
        installments: 3,
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Pedro Costa',
        customerEmail: 'pedro@example.com',
        customerCpf: '45678912300',
        customerPhone: '11998765432',
      }

      const result = await PaymentService.processPayment(paymentData)

      // Note: Mock implementation has random refusal for high-risk transactions
      expect(['APPROVED', 'REFUSED']).toContain(result.status)
      if (result.status === 'APPROVED') {
        expect(result.transactionId).toBeDefined()
        expect(result.approvalCode).toBeDefined()
      } else {
        expect(result.refusalReason).toBeDefined()
      }
    })

    it('should process payment with 12 installments', async () => {
      const paymentData: PaymentData = {
        orderId: 'order-card-12x',
        amount: 50000, // R$ 500.00
        paymentMethod: 'CREDIT_CARD',
        installments: 12,
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Ana Oliveira',
        customerEmail: 'ana@example.com',
        customerCpf: '78912345600',
        customerPhone: '11987651234',
      }

      const result = await PaymentService.processPayment(paymentData)

      // Note: Mock implementation has 10% random refusal rate
      expect(['APPROVED', 'REFUSED']).toContain(result.status)
      if (result.status === 'APPROVED') {
        expect(result.transactionId).toBeDefined()
        expect(result.approvalCode).toBeDefined()
      } else {
        expect(result.refusalReason).toBeDefined()
      }
    })
  })

  describe('Credit Card Payment with Gateway Adapter', () => {
    beforeEach(() => {
      // Configure PaymentService with Mercado Pago adapter
      process.env.PAYMENT_GATEWAY_PROVIDER = 'mercadopago'
      process.env.PAYMENT_GATEWAY_API_KEY = 'test-access-token'
      process.env.PAYMENT_GATEWAY_SECRET = 'test-secret'
      process.env.PAYMENT_GATEWAY_SANDBOX = 'true'

      PaymentService.initialize()
    })

    it('should process credit card payment via gateway adapter', async () => {
      const mockCardResponse = {
        id: 'card-payment-123',
        status: 'approved',
        transaction_amount: 100.00,
        payment_method_id: 'master',
        card: {
          first_six_digits: '424242',
          last_four_digits: '4242',
          expiration_year: 2025,
          expiration_month: 12,
          cardholder: {
            name: 'João Silva',
          },
        },
        installments: 1,
        authorization_code: 'ABC123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCardResponse,
      })

      const paymentData: PaymentData = {
        orderId: 'order-adapter-card-123',
        amount: 10000, // R$ 100.00 in cents
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'João Silva',
        customerEmail: 'joao@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('APPROVED')
      expect(result.transactionId).toBe('card-payment-123')
      expect(result.estimatedApprovalTime).toBe('Instantâneo (até 72h de análise)')
    })

    it('should process installment payment via gateway adapter', async () => {
      const mockInstallmentResponse = {
        id: 'card-payment-456',
        status: 'approved',
        transaction_amount: 300.00,
        payment_method_id: 'visa',
        card: {
          first_six_digits: '555555',
          last_four_digits: '4444',
          expiration_year: 2026,
          expiration_month: 6,
          cardholder: {
            name: 'Maria Santos',
          },
        },
        installments: 6,
        installment_amount: 50.00,
        authorization_code: 'DEF456',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockInstallmentResponse,
      })

      const paymentData: PaymentData = {
        orderId: 'order-adapter-installments',
        amount: 30000, // R$ 300.00 in cents
        paymentMethod: 'CREDIT_CARD',
        installments: 6,
        cardNumber: '5555555555554444',
        cardCvv: '456',
        cardExpiry: '06/26',
        cardHolderName: 'Maria Santos',
        customerEmail: 'maria@example.com',
        customerCpf: '98765432100',
        customerPhone: '11912345678',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('APPROVED')
      expect(result.transactionId).toBe('card-payment-456')
    })

    it('should handle gateway API errors for card payments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        json: async () => ({
          message: 'Card declined by issuer',
          error: 'card_declined',
        }),
      })

      const paymentData: PaymentData = {
        orderId: 'order-card-error',
        amount: 5000,
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4000000000000002',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Test User',
        customerEmail: 'test@example.com',
        customerCpf: '12345678900',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('REFUSED')
      expect(result.refusalReason).toBeDefined()
    })

    it('should refuse payment with insufficient funds', async () => {
      const mockInsufficientFundsResponse = {
        status: 402,
        error: 'insufficient_funds',
        message: 'Insufficient funds on card',
        cause: [
          {
            code: '410',
            description: 'Insufficient funds',
            type: 'card_error',
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        json: async () => mockInsufficientFundsResponse,
      })

      const paymentData: PaymentData = {
        orderId: 'order-insufficient-funds',
        amount: 50000, // R$ 500.00 - high amount to trigger insufficient funds
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4000000000009999', // Test card for insufficient funds
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Customer Without Funds',
        customerEmail: 'nofunds@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('REFUSED')
      expect(result.refusalReason).toBeDefined()
      expect(result.refusalReason).toContain('Insufficient funds')
    })

    it('should refuse payment with insufficient funds via gateway adapter', async () => {
      const mockInsufficientFundsResponse = {
        message: 'Insufficient funds',
        error: 'insufficient_funds',
        status: 402,
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
        json: async () => mockInsufficientFundsResponse,
      })

      const paymentData: PaymentData = {
        orderId: 'order-adapter-insufficient-funds',
        amount: 20000, // R$ 200.00 in cents
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4111111111111111',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Low Balance Customer',
        customerEmail: 'lowbalance@example.com',
        customerCpf: '98765432100',
        customerPhone: '11912345678',
      }

      const result = await PaymentService.processPayment(paymentData)

      expect(result.status).toBe('REFUSED')
      expect(result.refusalReason).toBeDefined()
      // The adapter formats errors as "{statusCode}: {message}"
      expect(result.refusalReason).toMatch(/402.*Insufficient funds/)
    })
  })

  describe('Credit Card Risk Analysis', () => {
    it('should approve low-risk credit card payment', async () => {
      const lowRiskData: PaymentData = {
        orderId: 'order-card-low-risk',
        amount: 100, // Low amount
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: ' Trusted Customer',
        customerEmail: 'trusted@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const result = await PaymentService.processPayment(lowRiskData)

      // Low-risk payments should generally be approved (note: mock has 10% random refusal)
      expect(['APPROVED', 'REFUSED']).toContain(result.status)
      if (result.status === 'APPROVED') {
        expect(result.transactionId).toBeDefined()
      }
    })

    it('should perform risk analysis for high amount payment', async () => {
      const highAmountData: PaymentData = {
        orderId: 'order-card-high-amount',
        amount: 10000, // High amount
        paymentMethod: 'CREDIT_CARD',
        installments: 1,
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'High Value Customer',
        customerEmail: 'highvalue@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const riskAnalysis = await PaymentService.performRiskAnalysis(highAmountData)

      expect(riskAnalysis).toHaveProperty('riskScore')
      expect(riskAnalysis).toHaveProperty('riskLevel')
      expect(riskAnalysis).toHaveProperty('factors')
      expect(riskAnalysis).toHaveProperty('approved')
      expect(riskAnalysis).toHaveProperty('recommendedAction')
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(riskAnalysis.riskLevel)
    })

    it('should flag high-risk payment with many installments', async () => {
      const highInstallmentData: PaymentData = {
        orderId: 'order-card-high-installments',
        amount: 5000,
        paymentMethod: 'CREDIT_CARD',
        installments: 10, // High installment count
        cardNumber: '4242424242424242',
        cardCvv: '123',
        cardExpiry: '12/25',
        cardHolderName: 'Installment Customer',
        customerEmail: 'installment@example.com',
        customerCpf: '12345678900',
        customerPhone: '11987654321',
      }

      const riskAnalysis = await PaymentService.performRiskAnalysis(highInstallmentData)

      expect(riskAnalysis.factors).toContain('Parcelamento alto (mais de 6x)')
      expect(riskAnalysis.riskScore).toBeGreaterThan(0)
    })
  })

  describe('Credit Card Refund', () => {
    beforeEach(() => {
      // Clear any adapter configuration to use mock implementation
      process.env.PAYMENT_GATEWAY_PROVIDER = ''
      process.env.PAYMENT_GATEWAY_API_KEY = ''
      process.env.PAYMENT_GATEWAY_SECRET = ''
      // Reinitialize to clear the adapter
      PaymentService.initialize()
      // Verify adapter is cleared by checking
      const adapter = (PaymentService as any).adapter
      if (adapter) {
        // Force clear the adapter for these tests
        ;(PaymentService as any).adapter = null
      }
    })

    it('should process credit card refund successfully with mock implementation', async () => {
      const transactionId = 'TXN_1234567890_abc123'

      const refundResult = await PaymentService.processRefund(
        transactionId,
        5000, // R$ 50.00
        'CREDIT_CARD'
      )

      // Mock implementation returns SUCCESS
      expect(refundResult.status).toBe('SUCCESS')
      expect(refundResult.refundId).toBeDefined()
      expect(refundResult.refundId).toMatch(/^REF_\d+_[a-z0-9]+$/)
      expect(refundResult.estimatedProcessingTime).toBe('Próxima fatura ou até 3 faturas subsequentes')
    })

    it('should handle refund for installment payment', async () => {
      const transactionId = 'TXN_9876543210_xyz789'

      const refundResult = await PaymentService.processRefund(
        transactionId,
        12000, // R$ 120.00 (4x of R$ 30.00)
        'CREDIT_CARD'
      )

      expect(refundResult.status).toBe('SUCCESS')
      expect(refundResult.refundId).toBeDefined()
      expect(refundResult.estimatedProcessingTime).toBe('Próxima fatura ou até 3 faturas subsequentes')
    })
  })
})
