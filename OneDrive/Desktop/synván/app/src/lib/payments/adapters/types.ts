/**
 * Payment Gateway Adapter Types
 *
 * This module defines the interface and types for payment gateway adapters.
 * It provides a unified abstraction layer for different payment gateway providers.
 */

/**
 * Supported payment methods across all gateways
 */
export enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  BOLETO = 'boleto',
}

/**
 * Payment status enumeration matching gateway responses
 */
export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PROCESSING = 'processing',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  CHARGEBACK = 'chargeback',
  EXPIRED = 'expired',
}

/**
 * Customer information for payment processing
 */
export interface Customer {
  name: string
  email: string
  phone?: string
  cpf?: string
  address?: Address
}

/**
 * Customer address (required for some payment methods)
 */
export interface Address {
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
}

/**
 * Pix payment details
 */
export interface PixPaymentDetails {
  copyPasteCode: string
  expirationDate: Date
}

/**
 * Credit card payment details
 */
export interface CreditCardPaymentDetails {
  token: string
  lastFourDigits: string
  brand: string
  holderName: string
  installments?: InstallmentDetails
}

/**
 * Installment details for credit card payments
 */
export interface InstallmentDetails {
  count: number
  amount: number // Amount per installment in cents
  totalAmount: number // Total amount in cents
  interestRate?: number
}

/**
 * Boleto payment details
 */
export interface BoletoPaymentDetails {
  url: string
  barcode: string
  expirationDate: Date
}

/**
 * Union type for all payment method specific details
 */
export type PaymentDetails = PixPaymentDetails | CreditCardPaymentDetails | BoletoPaymentDetails

/**
 * Request to create a payment
 */
export interface CreatePaymentRequest {
  orderId: string
  amount: number // Amount in cents (R$ 100.00 = 10000)
  paymentMethod: PaymentMethod
  customer: Customer
  paymentDetails: PaymentDetails
  metadata?: Record<string, any>
}

/**
 * Pix details returned after payment creation
 */
export interface PixResponseDetails {
  qrCodeString: string
  copyPasteCode: string
  qrCodeBase64?: string
}

/**
 * Boleto details returned after payment creation
 */
export interface BoletoResponseDetails {
  url: string
  barcode: string
}

/**
 * Response from payment creation
 */
export interface CreatePaymentResponse {
  success: boolean
  paymentId: string
  status: PaymentStatus
  paymentMethod: PaymentMethod
  transactionAmount: number // Amount in cents
  pixDetails?: PixResponseDetails
  boletoDetails?: BoletoResponseDetails
  approvalDate?: Date
  errorCode?: string
  errorMessage?: string
}

/**
 * Payment status information
 */
export interface PaymentStatusInfo {
  paymentId: string
  status: PaymentStatus
  transactionAmount: number // Amount in cents
  approvalDate?: Date
  refundDate?: Date
}

/**
 * Request to refund a payment
 */
export interface RefundRequest {
  paymentId: string
  amount?: number // Amount in cents (if omitted, full refund)
}

/**
 * Refund response
 */
export interface RefundResponse {
  success: boolean
  refundId: string
  amount: number // Amount refunded in cents
  status: 'approved' | 'pending' | 'failed'
  errorCode?: string
  errorMessage?: string
}

/**
 * Webhook notification event types
 */
export type WebhookEventType =
  | 'payment_created'
  | 'payment_updated'
  | 'payment_approved'
  | 'payment_authorized'
  | 'payment_pending'
  | 'payment_declined'
  | 'payment_refunded'
  | 'payment_cancelled'
  | 'payment_chargeback'

/**
 * Parsed webhook notification
 */
export interface WebhookNotification {
  eventType: WebhookEventType
  paymentId: string
  orderId?: string
  status: PaymentStatus
  transactionAmount?: number
  rawPayload: any
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  apiKey: string
  apiSecret: string
  sandbox: boolean
  webhookSecret?: string
}

/**
 * Payment Gateway Adapter Interface
 *
 * This interface defines the contract that all payment gateway adapters must implement.
 * It provides a unified API for payment operations regardless of the underlying gateway.
 */
export interface IPaymentGatewayAdapter {
  /**
   * Create a new payment
   * @param request - Payment creation request
   * @returns Promise resolving to payment creation response
   */
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>

  /**
   * Get the status of an existing payment
   * @param paymentId - Payment ID from the gateway
   * @returns Promise resolving to payment status information
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatusInfo>

  /**
   * Refund a payment (full or partial)
   * @param request - Refund request
   * @returns Promise resolving to refund response
   */
  refundPayment(request: RefundRequest): Promise<RefundResponse>

  /**
   * Cancel a pending payment
   * @param paymentId - Payment ID to cancel
   * @returns Promise resolving to true if cancellation was successful
   */
  cancelPayment(paymentId: string): Promise<boolean>

  /**
   * Verify webhook signature and parse notification
   * @param signature - Signature from webhook header
   * @param payload - Raw webhook payload
   * @returns Parsed webhook notification
   * @throws Error if signature is invalid
   */
  verifyWebhook(signature: string, payload: any): WebhookNotification

  /**
   * Health check for the gateway connection
   * @returns Promise resolving to true if gateway is accessible
   */
  healthCheck(): Promise<boolean>

  /**
   * Get the gateway provider name
   * @returns Provider name (e.g., 'mercadopago', 'pagseguro')
   */
  getProviderName(): string
}
