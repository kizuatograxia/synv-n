/**
 * Mercado Pago Payment Gateway Adapter
 *
 * Implementation of IPaymentGatewayAdapter for Mercado Pago.
 * Supports: Pix, Credit Card (with installments), Boleto
 *
 * API Documentation: https://www.mercadopago.com.br/developers
 */

import crypto from 'crypto';
import {
  IPaymentGatewayAdapter,
  PaymentGatewayConfig,
  CreatePaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentMethod,
  RefundRequest,
  RefundResponse,
  WebhookNotification,
  WebhookEventType,
  PixPaymentDetails,
  BoletoPaymentDetails,
} from './types';

/**
 * Mercado Pago-specific error codes
 */
enum MercadoPagoErrorCode {
  CARD_DECLINED = 'card_declined',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  INVALID_CARD = 'invalid_card',
  DUPLICATE_PAYMENT = 'duplicate_payment',
}

/**
 * Mercado Pago API endpoints
 */
const MERCADO_PAGO_API_URLS = {
  production: 'https://api.mercadopago.com',
  sandbox: 'https://api.mercadolibre.com',
};

/**
 * Mercado Pago Payment Adapter
 */
export class MercadoPagoAdapter implements IPaymentGatewayAdapter {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly sandbox: boolean;
  private readonly webhookSecret?: string;
  private readonly baseUrl: string;

  constructor(config: PaymentGatewayConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.sandbox = config.sandbox;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.baseUrl || (config.sandbox ? MERCADO_PAGO_API_URLS.sandbox : MERCADO_PAGO_API_URLS.production);
  }

  /**
   * Get authorization header for API requests
   */
  private getAuthHeader(): string {
    return `Bearer ${this.apiKey}`;
  }

  /**
   * Make HTTP request to Mercado Pago API
   */
  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Mercado Pago API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a new payment
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    try {
      const paymentData = this.buildPaymentRequest(request);

      const response = await this.apiRequest<any>('/v1/payments', 'POST', paymentData);

      return this.mapToPaymentResponse(response);
    } catch (error) {
      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.DECLINED,
        transactionAmount: request.amount,
        paymentMethod: request.paymentMethod,
        errorCode: 'API_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build payment request payload for Mercado Pago API
   */
  private buildPaymentRequest(request: CreatePaymentRequest): Record<string, unknown> {
    const basePayload = {
      transaction_amount: request.amount / 100, // Convert cents to reais
      description: `Order ${request.orderId}`,
      external_reference: request.orderId,
      metadata: request.metadata || {},
      payer: {
        email: request.customer.email,
        first_name: request.customer.name.split(' ')[0],
        last_name: request.customer.name.split(' ').slice(1).join(' '),
        phone: {
          area_code: request.customer.phone.substring(0, 2),
          number: request.customer.phone.substring(2),
        },
        identification: request.customer.cpf ? {
          type: 'CPF',
          number: request.customer.cpf,
        } : undefined,
        address: request.customer.address ? {
          zip_code: request.customer.address.zipCode,
          street_name: request.customer.address.street,
          street_number: request.customer.address.number,
          complement: request.customer.address.complement,
          neighborhood: request.customer.address.neighborhood,
          city: request.customer.address.city,
          federal_unit: request.customer.address.state,
        } : undefined,
      },
    };

    // Payment method specific configuration
    switch (request.paymentMethod) {
      case PaymentMethod.PIX:
        return {
          ...basePayload,
          payment_method_id: 'pix',
          date_of_expiration: this.calculatePixExpiration(),
        };

      case PaymentMethod.CREDIT_CARD:
        const cardDetails = request.paymentDetails as { installments?: { count: number } };
        return {
          ...basePayload,
          payment_method_id: 'master', // Will be determined from card token
          token: (request.paymentDetails as { token: string }).token,
          installments: cardDetails.installments?.count || 1,
          capture: true, // Auto-capture payment
        };

      case PaymentMethod.BOLETO:
        return {
          ...basePayload,
          payment_method_id: 'bolbradesco',
          date_of_expiration: this.calculateBoletoExpiration(),
        };

      default:
        throw new Error(`Unsupported payment method: ${request.paymentMethod}`);
    }
  }

  /**
   * Calculate Pix expiration date (typically 30 minutes to 24 hours)
   */
  private calculatePixExpiration(): string {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24); // 24 hour expiration
    return expiration.toISOString();
  }

  /**
   * Calculate Boleto expiration date (typically 3-5 business days)
   */
  private calculateBoletoExpiration(): string {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 5); // 5 day expiration
    return expiration.toISOString();
  }

  /**
   * Map Mercado Pago API response to PaymentResponse
   */
  private mapToPaymentResponse(response: any): PaymentResponse {
    const paymentMethod = this.mapPaymentMethod(response.payment_method_id);
    const status = this.mapPaymentStatus(response.status);

    const paymentResponse: PaymentResponse = {
      success: status === PaymentStatus.APPROVED,
      paymentId: response.id.toString(),
      status,
      transactionAmount: Math.round(response.transaction_amount * 100), // Convert reais to cents
      paymentMethod,
      approvalDate: response.date_approved ? new Date(response.date_approved) : undefined,
      metadata: response.metadata,
    };

    // Add Pix details if applicable
    if (paymentMethod === PaymentMethod.PIX && response.point_of_interaction) {
      paymentResponse.pixDetails = {
        qrCodeString: response.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64,
        copyPasteCode: response.point_of_interaction.transaction_data.ticket_url,
        expirationDate: new Date(response.date_of_expiration),
      };
    }

    // Add Boleto details if applicable
    if (paymentMethod === PaymentMethod.BOLETO && response.transaction_details) {
      paymentResponse.boletoDetails = {
        url: response.transaction_details.external_resource_url,
        barcode: response.barcode?.content || '',
        expirationDate: new Date(response.date_of_expiration),
      };
    }

    return paymentResponse;
  }

  /**
   * Map Mercado Pago payment method to PaymentMethod enum
   */
  private mapPaymentMethod(mpMethod: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      'pix': PaymentMethod.PIX,
      'master': PaymentMethod.CREDIT_CARD,
      'visa': PaymentMethod.CREDIT_CARD,
      'amex': PaymentMethod.CREDIT_CARD,
      'elo': PaymentMethod.CREDIT_CARD,
      'hiper': PaymentMethod.CREDIT_CARD,
      'bolbradesco': PaymentMethod.BOLETO,
      'bb': PaymentMethod.BOLETO,
    };

    return methodMap[mpMethod] || PaymentMethod.CREDIT_CARD;
  }

  /**
   * Map Mercado Pago status to PaymentStatus enum
   */
  private mapPaymentStatus(mpStatus: string): PaymentStatus {
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
    };

    return statusMap[mpStatus] || PaymentStatus.PENDING;
  }

  /**
   * Get payment status from gateway
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      const response = await this.apiRequest<any>(`/v1/payments/${paymentId}`, 'GET');
      return this.mapToPaymentResponse(response);
    } catch (error) {
      throw new Error(`Failed to get payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a refund (full or partial)
   */
  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refundData = {
        amount: request.amount ? request.amount / 100 : undefined, // Convert cents to reais
      };

      const response = await this.apiRequest<any>(
        `/v1/payments/${request.paymentId}/refunds`,
        'POST',
        refundData
      );

      return {
        success: true,
        refundId: response.id.toString(),
        amount: Math.round((response.amount || 0) * 100), // Convert reais to cents
        status: response.status === 'approved' ? 'approved' : 'pending',
      };
    } catch (error) {
      return {
        success: false,
        refundId: '',
        amount: request.amount || 0,
        status: 'failed',
        errorCode: 'REFUND_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify webhook signature and parse notification
   */
  verifyWebhook(signature: string, payload: unknown): WebhookNotification {
    if (!this.webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    // Mercado Pago sends a signature in the X-Signature header
    // Format: ts:<timestamp>,v1:<signature>
    const parts = signature.split(',');
    const signatureParts: Record<string, string> = {};

    for (const part of parts) {
      const [key, value] = part.split(':');
      signatureParts[key] = value;
    }

    const receivedSignature = signatureParts.v1;
    const timestamp = signatureParts.ts;

    if (!receivedSignature || !timestamp) {
      throw new Error('Invalid signature format');
    }

    // Verify signature
    const payloadString = JSON.stringify(payload);
    const dataToSign = `${timestamp}${payloadString}`;
    const calculatedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(dataToSign)
      .digest('hex');

    if (receivedSignature !== calculatedSignature) {
      throw new Error('Invalid webhook signature');
    }

    // Parse webhook notification
    const notification = payload as any;
    const paymentData = notification.data || notification;

    return {
      eventType: this.mapWebhookEventType(notification.type || notification.topic),
      paymentId: paymentData.id?.toString() || '',
      orderId: paymentData.external_reference,
      status: this.mapPaymentStatus(notification.status || 'pending'),
      transactionAmount: Math.round((paymentData.transaction_amount || 0) * 100),
      paymentMethod: this.mapPaymentMethod(paymentData.payment_method_id || 'pix'),
      date: new Date(notification.date_created || Date.now()),
      metadata: paymentData.metadata,
    };
  }

  /**
   * Map Mercado Pago webhook type to WebhookEventType
   */
  private mapWebhookEventType(mpType: string): WebhookEventType {
    const typeMap: Record<string, WebhookEventType> = {
      'payment_approved': WebhookEventType.PAYMENT_APPROVED,
      'payment_authorized': WebhookEventType.PAYMENT_APPROVED,
      'payment declined': WebhookEventType.PAYMENT_DECLINED,
      'payment_canceled': WebhookEventType.PAYMENT_CANCELLED,
      'payment_refunded': WebhookEventType.PAYMENT_REFUNDED,
      'payment_charged_back': WebhookEventType.PAYMENT_CHARGEBACK,
      'payment_expired': WebhookEventType.PAYMENT_EXPIRED,
    };

    return typeMap[mpType] || WebhookEventType.PAYMENT_APPROVED;
  }

  /**
   * Cancel a pending payment
   */
  async cancelPayment(paymentId: string): Promise<boolean> {
    try {
      await this.apiRequest(`/v1/payments/${paymentId}`, 'PUT', {
        status: 'cancelled',
      });
      return true;
    } catch (error) {
      console.error('Failed to cancel payment:', error);
      return false;
    }
  }

  /**
   * Health check for gateway connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a simple request to check API connectivity
      await this.apiRequest('/v1/payment_methods', 'GET');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get gateway provider name
   */
  getProviderName(): string {
    return 'mercadopago';
  }
}

/**
 * Factory function to create Mercado Pago adapter
 */
export function createMercadoPagoAdapter(config: PaymentGatewayConfig): MercadoPagoAdapter {
  return new MercadoPagoAdapter(config);
}
