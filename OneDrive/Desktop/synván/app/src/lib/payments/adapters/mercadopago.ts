/**
 * Mercado Pago Payment Gateway Adapter
 *
 * This adapter implements the IPaymentGatewayAdapter interface for Mercado Pago.
 * It supports Pix, credit cards, and boleto payment methods.
 *
 * API Documentation: https://www.mercadopago.com.br/developers/en/docs/checkout-api
 */

import * as crypto from 'crypto'
import {
  IPaymentGatewayAdapter,
  GatewayConfig,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatus,
  PaymentMethod,
  PaymentStatusInfo,
  RefundRequest,
  RefundResponse,
  WebhookNotification,
  PixResponseDetails,
  BoletoResponseDetails,
  CreditCardPaymentDetails,
  PixPaymentDetails,
  BoletoPaymentDetails,
} from './types'
import { createCircuitBreaker, isCircuitBreakerOpenError } from '../../resilience'

/**
 * Mercado Pago API endpoints
 */
const MERCADO_PAGO_API = {
  PRODUCTION: 'https://api.mercadopago.com',
  SANDBOX: 'https://api.mercadopago.com',
}

/**
 * Mercado Pago payment method IDs
 */
const MERCADO_PAGO_PAYMENT_METHODS = {
  PIX: 'pix',
  BOLETO: 'bolbradesco',
  CREDIT_CARD: {
    visa: 'visa',
    master: 'master',
    amex: 'amex',
    elo: 'elo',
    hipercard: 'hipercard',
  },
}

/**
 * Mercado Pago Adapter Implementation
 */
export class MercadoPagoAdapter implements IPaymentGatewayAdapter {
  private config: GatewayConfig
  private baseUrl: string
  private circuitBreaker = createCircuitBreaker({
    name: 'MercadoPagoGateway',
    config: {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxCalls: 3,
      loggingEnabled: process.env.NODE_ENV === 'development',
    },
  })

  constructor(config: GatewayConfig) {
    this.config = config
    this.baseUrl = config.sandbox ? MERCADO_PAGO_API.SANDBOX : MERCADO_PAGO_API.PRODUCTION
  }

  /**
   * Get the provider name
   */
  getProviderName(): string {
    return 'mercadopago'
  }

  /**
   * Create a new payment
   */
  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.circuitBreaker.execute(async () => {
      try {
        const paymentData = this.buildPaymentRequest(request)

        const response = await fetch(`${this.baseUrl}/v1/payments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentData),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          throw new Error(`${response.status}: ${errorData.message || response.statusText}`)
        }

        const data = await response.json()
        return this.parsePaymentResponse(data, request.paymentMethod, request.amount)
      } catch (error) {
        // Re-throw to let circuit breaker handle it
        throw error
      }
    }).catch((error) => {
      // Handle circuit breaker errors
      if (isCircuitBreakerOpenError(error)) {
        return {
          success: false,
          paymentId: '',
          status: PaymentStatus.DECLINED,
          paymentMethod: request.paymentMethod,
          transactionAmount: request.amount,
          errorCode: 'CIRCUIT_OPEN',
          errorMessage: 'Payment gateway temporarily unavailable. Please try again.',
        }
      }

      // Handle other errors
      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.DECLINED,
        paymentMethod: request.paymentMethod,
        transactionAmount: request.amount,
        errorCode: error instanceof Error && error.message.includes('fetch') ? 'NETWORK_ERROR' : 'API_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    })
  }

  /**
   * Build payment request body for Mercado Pago API
   */
  private buildPaymentRequest(request: CreatePaymentRequest): any {
    const payer: any = {
      email: request.customer.email,
    }

    // Add payer information
    if (request.customer.name) {
      payer.first_name = request.customer.name.split(' ')[0]
      payer.last_name = request.customer.name.split(' ').slice(1).join(' ') || request.customer.name
    }

    if (request.customer.cpf) {
      payer.identification = {
        type: 'CPF',
        number: request.customer.cpf,
      }
    }

    if (request.customer.address) {
      payer.address = {
        street_name: request.customer.address.street,
        street_number: request.customer.address.number,
        complement: request.customer.address.complement,
        neighborhood: request.customer.address.neighborhood,
        city: request.customer.address.city,
        federal_unit: request.customer.address.state,
        zip_code: request.customer.address.zipCode.replace(/\D/g, ''),
      }
    }

    const baseRequest: any = {
      transaction_amount: request.amount / 100, // Convert cents to reais
      description: `Order ${request.orderId}`,
      payment_method_id: this.getPaymentMethodId(request),
      external_reference: request.orderId,
      metadata: request.metadata || {},
      payer,
    }

    // Add payment method specific details
    switch (request.paymentMethod) {
      case PaymentMethod.PIX:
        return {
          ...baseRequest,
          date_of_expiration: (request.paymentDetails as PixPaymentDetails).expirationDate.toISOString(),
        }

      case PaymentMethod.CREDIT_CARD:
        const cardDetails = request.paymentDetails as CreditCardPaymentDetails
        return {
          ...baseRequest,
          token: cardDetails.token,
          installments: cardDetails.installments?.count || 1,
          payment_method_id: cardDetails.brand,
        }

      case PaymentMethod.BOLETO:
        const boletoDetails = request.paymentDetails as BoletoPaymentDetails
        return {
          ...baseRequest,
          date_of_expiration: boletoDetails.expirationDate.toISOString(),
        }

      default:
        return baseRequest
    }
  }

  /**
   * Get Mercado Pago payment method ID
   */
  private getPaymentMethodId(request: CreatePaymentRequest): string {
    switch (request.paymentMethod) {
      case PaymentMethod.PIX:
        return MERCADO_PAGO_PAYMENT_METHODS.PIX
      case PaymentMethod.BOLETO:
        return MERCADO_PAGO_PAYMENT_METHODS.BOLETO
      case PaymentMethod.CREDIT_CARD:
        const cardDetails = request.paymentDetails as CreditCardPaymentDetails
        return cardDetails.brand || MERCADO_PAGO_PAYMENT_METHODS.CREDIT_CARD.visa
      default:
        throw new Error(`Unsupported payment method: ${request.paymentMethod}`)
    }
  }

  /**
   * Parse payment response from Mercado Pago API
   */
  private parsePaymentResponse(
    data: any,
    paymentMethod: PaymentMethod,
    requestAmount: number
  ): CreatePaymentResponse {
    const response: CreatePaymentResponse = {
      success: true,
      paymentId: data.id,
      status: this.mapPaymentStatus(data.status),
      paymentMethod,
      transactionAmount: requestAmount,
    }

    // Add approval date if available
    if (data.date_approved) {
      response.approvalDate = new Date(data.date_approved)
    }

    // Add Pix details
    if (paymentMethod === PaymentMethod.PIX && data.point_of_interaction?.transaction_data) {
      const pixData = data.point_of_interaction.transaction_data
      response.pixDetails = {
        qrCodeString: pixData.qr_code,
        copyPasteCode: pixData.ticket_url || pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64,
      }
    }

    // Add Boleto details
    if (paymentMethod === PaymentMethod.BOLETO && data.transaction_details?.external_resource_url) {
      response.boletoDetails = {
        url: data.transaction_details.external_resource_url,
        barcode: data.barcode?.content || '',
      }
    }

    return response
  }

  /**
   * Map Mercado Pago status to our PaymentStatus enum
   */
  private mapPaymentStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'pending': PaymentStatus.PENDING,
      'approved': PaymentStatus.APPROVED,
      'authorized': PaymentStatus.APPROVED,
      'in_process': PaymentStatus.PROCESSING,
      'in_mediation': PaymentStatus.PROCESSING,
      'rejected': PaymentStatus.DECLINED,
      'cancelled': PaymentStatus.CANCELLED,
      'refunded': PaymentStatus.REFUNDED,
      'charged_back': PaymentStatus.CHARGEBACK,
      'expired': PaymentStatus.EXPIRED,
    }

    return statusMap[status] || PaymentStatus.PENDING
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusInfo> {
    const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      paymentId: data.id,
      status: this.mapPaymentStatus(data.status),
      transactionAmount: Math.round(data.transaction_amount * 100), // Convert reais to cents
      approvalDate: data.date_approved ? new Date(data.date_approved) : undefined,
      refundDate: data.date_refunded ? new Date(data.date_refunded) : undefined,
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    return this.circuitBreaker.execute(async () => {
      try {
        const url = request.amount
          ? `${this.baseUrl}/v1/payments/${request.paymentId}/refunds`
          : `${this.baseUrl}/v1/payments/${request.paymentId}/refunds`

        const body = request.amount ? { amount: request.amount / 100 } : {} // Convert cents to reais

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          throw new Error(`${response.status}: ${errorData.message || response.statusText}`)
        }

        const data = await response.json()

        return {
          success: true,
          refundId: data.id,
          amount: Math.round(data.amount * 100), // Convert reais to cents
          status: this.mapRefundStatus(data.status),
        }
      } catch (error) {
        // Re-throw to let circuit breaker handle it
        throw error
      }
    }).catch((error) => {
      // Handle circuit breaker errors
      if (isCircuitBreakerOpenError(error)) {
        return {
          success: false,
          refundId: '',
          amount: request.amount || 0,
          status: 'failed',
          errorCode: 'CIRCUIT_OPEN',
          errorMessage: 'Payment gateway temporarily unavailable. Please try again.',
        }
      }

      // Handle other errors
      return {
        success: false,
        refundId: '',
        amount: request.amount || 0,
        status: 'failed',
        errorCode: error instanceof Error && error.message.includes('fetch') ? 'NETWORK_ERROR' : 'REFUND_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    })
  }

  /**
   * Map refund status from Mercado Pago
   */
  private mapRefundStatus(status: string): 'approved' | 'pending' | 'failed' {
    if (status === 'approved' || status === 'created') {
      return 'approved'
    }
    if (status === 'pending' || status === 'in_process') {
      return 'pending'
    }
    return 'failed'
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      // Mercado Pago doesn't have a dedicated cancel endpoint
      // We need to update the payment status to cancelled
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Verify webhook signature and parse notification
   */
  verifyWebhook(signature: string, payload: any): WebhookNotification {
    if (!this.config.webhookSecret) {
      throw new Error('Webhook secret not configured')
    }

    // Parse signature header (format: ts:timestamp,v1:signature)
    const signatureParts = signature.split(',')
    const tsPart = signatureParts.find((part) => part.startsWith('ts:'))
    const v1Part = signatureParts.find((part) => part.startsWith('v1:'))

    if (!tsPart || !v1Part) {
      throw new Error('Invalid webhook signature format')
    }

    const timestamp = tsPart.substring(3)
    const receivedSignature = v1Part.substring(3)

    // Calculate expected signature
    const payloadString = JSON.stringify(payload)
    const dataToSign = `${timestamp}${payloadString}`
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(dataToSign)
      .digest('hex')

    // Verify signature
    if (receivedSignature !== expectedSignature) {
      throw new Error('Invalid webhook signature')
    }

    // Parse notification
    const eventType = this.mapWebhookEventType(payload.type || payload.action)

    return {
      eventType,
      paymentId: payload.data?.id || payload.payment_id || '',
      orderId: payload.data?.external_reference || payload.external_reference,
      status: this.mapPaymentStatusFromWebhook(payload),
      transactionAmount: payload.data?.transaction_amount
        ? Math.round(payload.data.transaction_amount * 100)
        : undefined,
      rawPayload: payload,
    }
  }

  /**
   * Map Mercado Pago webhook event type to our enum
   */
  private mapWebhookEventType(type: string): WebhookNotification['eventType'] {
    const eventMap: Record<string, WebhookNotification['eventType']> = {
      'payment_created': 'payment_created',
      'payment_updated': 'payment_updated',
      'payment_approved': 'payment_approved',
      'payment_authorized': 'payment_authorized',
      'payment_pending': 'payment_pending',
      'payment_declined': 'payment_declined',
      'payment_refunded': 'payment_refunded',
      'payment_cancelled': 'payment_cancelled',
      'payment_chargeback': 'payment_chargeback',
    }

    return eventMap[type] || 'payment_updated'
  }

  /**
   * Map payment status from webhook payload
   */
  private mapPaymentStatusFromWebhook(payload: any): PaymentStatus {
    // Try to get status from data object first, then from top level
    const status = payload.data?.status || payload.status

    if (!status) {
      return PaymentStatus.PENDING
    }

    return this.mapPaymentStatus(status)
  }

  /**
   * Health check
   * Returns false if circuit is open, otherwise checks gateway connectivity
   */
  async healthCheck(): Promise<boolean> {
    // If circuit is open, report unhealthy
    if (this.circuitBreaker.isOpen()) {
      return false
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000)
      })

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(`${this.baseUrl}/v1/payment_methods`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }),
        timeoutPromise,
      ]) as Response

      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Factory function to create a Mercado Pago adapter
 */
export function createMercadoPagoAdapter(config: GatewayConfig): IPaymentGatewayAdapter {
  return new MercadoPagoAdapter(config)
}
