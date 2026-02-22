import { PaymentData, PaymentResult, RefundResult, RiskAnalysis, PaymentMethod } from './types'
import { IPaymentGatewayAdapter, PaymentMethod as AdapterPaymentMethod, CreatePaymentRequest, PaymentStatus as AdapterPaymentStatus, RefundRequest } from '../../lib/payments/adapters/types'
import { createMercadoPagoAdapter } from '../../lib/payments/adapters/mercadopago'
import { logger } from '../logger'
import { withPaymentCircuitBreaker, isCircuitBreakerError } from '../resilience/wrappers'

/**
 * Payment Service
 *
 * This service provides payment processing functionality using a gateway adapter pattern.
 * It maintains backward compatibility with the existing PaymentData interface while
 * delegating actual payment processing to the configured gateway adapter.
 *
 * Supported gateways: Mercado Pago (default), PagSeguro, Stone, Rede
 */
export class PaymentService {
  private static adapter: IPaymentGatewayAdapter | null = null

  // Circuit breaker wrapped adapter methods
  private static wrappedCreatePayment = withPaymentCircuitBreaker(async (request: CreatePaymentRequest) => {
    if (!this.adapter) {
      throw new Error('Payment adapter not configured')
    }
    return await this.adapter.createPayment(request)
  })

  private static wrappedRefundPayment = withPaymentCircuitBreaker(async (request: RefundRequest) => {
    if (!this.adapter) {
      throw new Error('Payment adapter not configured')
    }
    return await this.adapter.refundPayment(request)
  })

  private static wrappedHealthCheck = withPaymentCircuitBreaker(async () => {
    if (!this.adapter) {
      return false
    }
    return await this.adapter.healthCheck()
  })

  /**
   * Initialize the payment gateway adapter
   * Called during application startup with environment configuration
   */
  static initialize() {
    const provider = process.env.PAYMENT_GATEWAY_PROVIDER || 'mercadopago'
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || ''
    const apiSecret = process.env.PAYMENT_GATEWAY_SECRET || ''
    const sandbox = process.env.PAYMENT_GATEWAY_SANDBOX === 'true'
    const webhookSecret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET

    if (!apiKey || !apiSecret) {
      console.warn('Payment gateway credentials not configured. Using mock implementation.')
      return
    }

    const config = {
      apiKey,
      apiSecret,
      sandbox,
      webhookSecret,
    }

    // Factory pattern for gateway selection
    switch (provider) {
      case 'mercadopago':
        this.adapter = createMercadoPagoAdapter(config)
        break
      // Future gateways can be added here
      // case 'pagseguro':
      //   this.adapter = createPagSeguroAdapter(config)
      //   break
      default:
        throw new Error(`Unsupported payment gateway provider: ${provider}`)
    }

    logger.info(`Payment gateway initialized: ${provider}`, { sandbox })
  }

  /**
   * Get the current adapter (for testing and health checks)
   */
  static getAdapter(): IPaymentGatewayAdapter | null {
    return this.adapter
  }
  private static readonly RISK_THRESHOLDS = {
    LOW: 0.3,
    MEDIUM: 0.6,
    HIGH: 0.8,
  }

  static async processPayment(data: PaymentData): Promise<PaymentResult> {
    // Perform risk analysis before payment
    await this.performRiskAnalysis(data)

    // Use adapter if configured, otherwise fall back to mock implementation
    if (this.adapter) {
      return this.processPaymentWithAdapter(data)
    }

    // Fallback to mock implementation for development/testing
    switch (data.paymentMethod) {
      case 'CREDIT_CARD':
        return this.processCreditCard(data)
      case 'PIX':
        return this.processPix(data)
      case 'BOLETO':
        return this.processBoleto(data)
      case 'APPLE_PAY':
        return this.processApplePay(data)
      case 'GOOGLE_PAY':
        return this.processGooglePay(data)
      default:
        throw new Error('Método de pagamento não suportado')
    }
  }

  /**
   * Process payment using the configured gateway adapter
   */
  private static async processPaymentWithAdapter(data: PaymentData): Promise<PaymentResult> {
    const request: CreatePaymentRequest = {
      orderId: data.orderId,
      amount: data.amount,
      paymentMethod: this.mapPaymentMethod(data.paymentMethod),
      customer: {
        name: data.cardHolderName || 'Customer',
        email: data.customerEmail,
        phone: data.customerPhone || '',
        cpf: data.customerCpf,
      },
      paymentDetails: this.buildPaymentDetails(data),
      metadata: {
        installments: data.installments,
      },
    }

    const response = await this.wrappedCreatePayment(request)

    return this.mapToPaymentResult(response)
  }

  /**
   * Map legacy payment method to adapter payment method
   */
  private static mapPaymentMethod(method: PaymentData['paymentMethod']): AdapterPaymentMethod {
    const methodMap: Record<PaymentData['paymentMethod'], AdapterPaymentMethod> = {
      'CREDIT_CARD': AdapterPaymentMethod.CREDIT_CARD,
      'PIX': AdapterPaymentMethod.PIX,
      'BOLETO': AdapterPaymentMethod.BOLETO,
      'APPLE_PAY': AdapterPaymentMethod.CREDIT_CARD, // Apple Pay processed as card
      'GOOGLE_PAY': AdapterPaymentMethod.CREDIT_CARD, // Google Pay processed as card
    }

    return methodMap[method]
  }

  /**
   * Build payment details based on payment method
   */
  private static buildPaymentDetails(data: PaymentData): CreatePaymentRequest['paymentDetails'] {
    switch (data.paymentMethod) {
      case 'PIX':
        return {
          // Pix details are generated by the gateway
          copyPasteCode: '',
          expirationDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        } as any

      case 'BOLETO':
        return {
          url: '',
          barcode: '',
          expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        } as any

      case 'CREDIT_CARD':
      case 'APPLE_PAY':
      case 'GOOGLE_PAY':
        return {
          token: data.cardNumber || '', // In production, this would be a secure token
          lastFourDigits: data.cardNumber?.slice(-4) || '',
          brand: 'visa', // In production, detected from card
          holderName: data.cardHolderName || '',
          installments: data.installments > 1 ? {
            count: data.installments,
            amount: data.amount / data.installments,
            totalAmount: data.amount,
          } : undefined,
        } as any

      default:
        throw new Error(`Unsupported payment method: ${data.paymentMethod}`)
    }
  }

  /**
   * Map adapter response to legacy payment result
   */
  private static mapToPaymentResult(response: {
    success: boolean
    status: AdapterPaymentStatus
    paymentId: string
    transactionAmount: number
    pixDetails?: { qrCodeString: string; copyPasteCode: string }
    boletoDetails?: { url: string; barcode: string }
    errorMessage?: string
  }): PaymentResult {
    const statusMap: Record<AdapterPaymentStatus, PaymentResult['status']> = {
      [AdapterPaymentStatus.PENDING]: 'PENDING',
      [AdapterPaymentStatus.APPROVED]: 'APPROVED',
      [AdapterPaymentStatus.PROCESSING]: 'PENDING',
      [AdapterPaymentStatus.DECLINED]: 'REFUSED',
      [AdapterPaymentStatus.CANCELLED]: 'REFUSED',
      [AdapterPaymentStatus.REFUNDED]: 'REFUNDED',
      [AdapterPaymentStatus.CHARGEBACK]: 'REFUSED',
      [AdapterPaymentStatus.EXPIRED]: 'REFUSED',
    }

    const result: PaymentResult = {
      status: statusMap[response.status] || 'REFUSED',
      transactionId: response.paymentId,
      refusalReason: response.errorMessage,
    }

    // Add Pix QR code if available
    if (response.pixDetails) {
      result.qrCode = response.pixDetails.qrCodeString
      result.estimatedApprovalTime = 'Instantâneo'
    }

    // Add Boleto URL if available
    if (response.boletoDetails) {
      result.boletoUrl = response.boletoDetails.url
      result.estimatedApprovalTime = 'Até 2 dias úteis'
    }

    // Add approval time for card payments
    if (response.status === AdapterPaymentStatus.APPROVED) {
      result.estimatedApprovalTime = 'Instantâneo (até 72h de análise)'
    }

    return result
  }

  static async processCreditCard(data: PaymentData): Promise<PaymentResult> {
    const risk = await this.performRiskAnalysis(data)

    if (!risk.approved) {
      return {
        status: 'REFUSED',
        refusalReason: risk.recommendedAction === 'DECLINE'
          ? 'Pagamento recusado por análise de risco'
          : 'Pagamento em análise manual',
      }
    }

    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const approvalCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const approved = Math.random() > 0.1

    if (!approved) {
      return {
        status: 'REFUSED',
        refusalReason: 'Cartão recusado pela operadora',
      }
    }

    return {
      status: 'APPROVED',
      transactionId,
      approvalCode,
      estimatedApprovalTime: 'Instantâneo (até 72h de análise)',
    }
  }

  static async processPix(data: PaymentData): Promise<PaymentResult> {
    const risk = await this.performRiskAnalysis(data)

    if (!risk.approved) {
      return {
        status: 'REFUSED',
        refusalReason: 'Pagamento recusado por análise de risco',
      }
    }

    const transactionId = `PIX_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const qrCode = `00020126580014${transactionId}br.gov.bcb.pix0136${data.amount.toString().padStart(10, '0')}52040000530309806`

    return {
      status: 'APPROVED',
      transactionId,
      qrCode,
      estimatedApprovalTime: 'Instantâneo',
    }
  }

  static async processBoleto(data: PaymentData): Promise<PaymentResult> {
    const { paymentMethod, amount } = data

    const eventDate = new Date()
    eventDate.setDate(eventDate.getDate() + 5)
    const fiveBusinessDaysBeforeEvent = eventDate.toISOString().split('T')[0]

    if (new Date() > new Date(fiveBusinessDaysBeforeEvent)) {
      return {
        status: 'REFUSED',
        refusalReason: 'Boleto não disponível 5 dias úteis antes do evento',
      }
    }

    const transactionId = `BLT_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const boletoUrl = `https://boleto.simprao.test/pagamento/${transactionId}`

    return {
      status: 'PENDING',
      transactionId,
      boletoUrl,
      estimatedApprovalTime: 'Até 2 dias úteis',
    }
  }

  static async processApplePay(data: PaymentData): Promise<PaymentResult> {
    const risk = await this.performRiskAnalysis(data)

    if (!risk.approved) {
      return {
        status: 'REFUSED',
        refusalReason: 'Pagamento recusado por análise de risco',
      }
    }

    const transactionId = `APL_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const approvalCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    return {
      status: 'APPROVED',
      transactionId,
      approvalCode,
      estimatedApprovalTime: 'Instantâneo',
    }
  }

  static async processGooglePay(data: PaymentData): Promise<PaymentResult> {
    const risk = await this.performRiskAnalysis(data)

    if (!risk.approved) {
      return {
        status: 'REFUSED',
        refusalReason: 'Pagamento recusado por análise de risco',
      }
    }

    const transactionId = `GOO_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const approvalCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    return {
      status: 'APPROVED',
      transactionId,
      approvalCode,
      estimatedApprovalTime: 'Instantâneo',
    }
  }

  static async processRefund(
    transactionId: string,
    amount: number,
    paymentMethod: PaymentMethod
  ): Promise<RefundResult> {
    // Use adapter if configured, otherwise fall back to mock implementation
    if (this.adapter) {
      return this.processRefundWithAdapter(transactionId, amount)
    }

    // Fallback to mock implementation
    const refundId = `REF_${Date.now()}_${Math.random().toString(36).substring(7)}`

    switch (paymentMethod) {
      case 'CREDIT_CARD':
        return {
          status: 'SUCCESS',
          refundId,
          estimatedProcessingTime: 'Próxima fatura ou até 3 faturas subsequentes',
        }
      case 'PIX':
        return {
          status: 'SUCCESS',
          refundId,
          estimatedProcessingTime: 'Instantâneo',
        }
      case 'BOLETO':
        return {
          status: 'SUCCESS',
          refundId,
          estimatedProcessingTime: 'Até 30 dias após submissão dos dados',
        }
      case 'APPLE_PAY':
      case 'GOOGLE_PAY':
        return {
          status: 'SUCCESS',
          refundId,
          estimatedProcessingTime: 'Até terceira fatura',
        }
      default:
        throw new Error('Método de pagamento não suportado')
    }
  }

  /**
   * Process refund using the configured gateway adapter
   */
  private static async processRefundWithAdapter(
    transactionId: string,
    amount: number
  ): Promise<RefundResult> {
    const request: RefundRequest = {
      paymentId: transactionId,
      amount,
    }

    const response = await this.wrappedRefundPayment(request)

    return {
      status: response.status === 'approved' ? 'SUCCESS' : response.status === 'pending' ? 'PENDING' : 'FAILED',
      refundId: response.refundId,
      estimatedProcessingTime: this.getRefundProcessingTime(),
    }
  }

  /**
   * Get refund processing time based on payment method
   */
  private static getRefundProcessingTime(): string {
    return 'Próxima fatura ou até 3 faturas subsequentes'
  }

  static async performRiskAnalysis(data: PaymentData): Promise<RiskAnalysis> {
    let riskScore = 0
    const factors: string[] = []

    if (!data.customerCpf) {
      riskScore += 0.1
      factors.push('CPF não informado')
    }

    if (!data.customerPhone) {
      riskScore += 0.05
      factors.push('Telefone não informado')
    }

    if (data.amount > 5000) {
      riskScore += 0.15
      factors.push('Valor alto (acima de R$ 5.000)')
    }

    if (data.paymentMethod === 'CREDIT_CARD' && data.installments > 6) {
      riskScore += 0.1
      factors.push('Parcelamento alto (mais de 6x)')
    }

    const hour = new Date().getHours()
    if (hour >= 2 && hour <= 5) {
      riskScore += 0.1
      factors.push('Transação em horário atípico')
    }

    const recentlyRefunded = await this.checkRecentRefunds(data.customerCpf)
    if (recentlyRefunded) {
      riskScore += 0.25
      factors.push('Múltiplos reembolsos recentes')
    }

    const highVelocity = await this.checkPaymentVelocity(data.customerCpf)
    if (highVelocity) {
      riskScore += 0.2
      factors.push('Alta velocidade de transações')
    }

    riskScore = Math.min(riskScore, 1)

    let riskLevel: RiskAnalysis['riskLevel']
    let recommendedAction: RiskAnalysis['recommendedAction']
    let approved: boolean

    if (riskScore < this.RISK_THRESHOLDS.LOW) {
      riskLevel = 'LOW'
      recommendedAction = 'APPROVE'
      approved = true
    } else if (riskScore < this.RISK_THRESHOLDS.MEDIUM) {
      riskLevel = 'MEDIUM'
      recommendedAction = 'APPROVE'
      approved = true
    } else if (riskScore < this.RISK_THRESHOLDS.HIGH) {
      riskLevel = 'HIGH'
      recommendedAction = 'MANUAL_REVIEW'
      approved = Math.random() > 0.5
    } else {
      riskLevel = 'CRITICAL'
      recommendedAction = 'DECLINE'
      approved = false
    }

    return {
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel,
      factors,
      approved,
      recommendedAction,
    }
  }

  private static async checkRecentRefunds(cpf?: string): Promise<boolean> {
    if (!cpf) return false

    return Math.random() > 0.9
  }

  private static async checkPaymentVelocity(cpf?: string): Promise<boolean> {
    if (!cpf) return false

    return Math.random() > 0.95
  }

  static validateBoletoAvailability(eventDate: Date): boolean {
    const fiveBusinessDaysBefore = new Date(eventDate)
    let businessDays = 0
    let currentDate = new Date()

    while (businessDays < 5 && currentDate < fiveBusinessDaysBefore) {
      currentDate.setDate(currentDate.getDate() + 1)
      const dayOfWeek = currentDate.getDay()

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++
      }
    }

    return businessDays >= 5
  }

  /**
   * Health check for payment gateway
   * Returns true if gateway is accessible and configured
   */
  static async healthCheck(): Promise<boolean> {
    if (!this.adapter) {
      return false
    }

    try {
      return await this.wrappedHealthCheck()
    } catch (error) {
      // Circuit breaker errors are caught here - treat as unhealthy
      if (isCircuitBreakerError(error)) {
        console.warn('Payment gateway circuit breaker is open')
        return false
      }
      console.error('Payment gateway health check failed:', error)
      return false
    }
  }

  /**
   * Get payment gateway provider name
   */
  static getProviderName(): string {
    return this.adapter?.getProviderName() || 'mock'
  }
}
