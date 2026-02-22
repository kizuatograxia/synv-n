/**
 * Payment Gateway Adapter Interface
 *
 * This interface defines the contract for payment gateway adapters,
 * allowing the platform to switch between different providers (e.g., Mercado Pago, PagSeguro)
 * without changing the core payment processing logic.
 *
 * Supported payment methods:
 * - Pix: Brazil's instant payment system (QR code based)
 * - Credit Card: Including installment payments
 * - Boleto: Bank slip payment method
 */

/**
 * Payment method types supported by the platform
 */
export enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BOLETO = 'boleto',
}

/**
 * Credit card installment options
 */
export interface InstallmentOptions {
  count: number; // Number of installments (1-12)
  amount: number; // Amount per installment
  totalAmount: number; // Total amount with interest
  interestRate?: number; // Annual interest rate applied
}

/**
 * Pix payment details
 */
export interface PixPaymentDetails {
  qrCodeString: string; // QR code data for scanning
  qrCodeBase64?: string; // Optional: QR code as base64 image
  copyPasteCode: string; // Code for copy-paste payment
  expirationDate: Date; // When the QR code expires
}

/**
 * Credit card payment details
 */
export interface CreditCardPaymentDetails {
  token: string; // Secure card token from gateway
  lastFourDigits: string; // Last 4 digits of card number
  brand: string; // Card brand (visa, mastercard, etc.)
  holderName: string; // Cardholder name
  installments?: InstallmentOptions; // Installment plan if applicable
}

/**
 * Boleto payment details
 */
export interface BoletoPaymentDetails {
  url: string; // URL to download PDF boleto
  barcode: string; // Typable barcode number
  expirationDate: Date; // When boleto expires (typically 3-5 days)
}

/**
 * Payment creation request
 */
export interface CreatePaymentRequest {
  orderId: string; // Internal order ID
  amount: number; // Payment amount in cents (R$ 10.00 = 1000)
  paymentMethod: PaymentMethod;
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf?: string; // Tax ID (optional for some payments)
    address?: {
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  paymentDetails: PixPaymentDetails | CreditCardPaymentDetails | BoletoPaymentDetails;
  metadata?: Record<string, unknown>; // Additional metadata for webhooks
}

/**
 * Payment response from gateway
 */
export interface PaymentResponse {
  success: boolean;
  paymentId: string; // Gateway payment ID
  status: PaymentStatus;
  transactionAmount: number; // Amount in cents
  paymentMethod: PaymentMethod;
  pixDetails?: PixPaymentDetails;
  boletoDetails?: BoletoPaymentDetails;
  approvalDate?: Date; // When payment was approved
  errorCode?: string; // Error code if failed
  errorMessage?: string; // Error message if failed
  metadata?: Record<string, unknown>; // Gateway-specific metadata
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  CHARGEBACK = 'chargeback',
  EXPIRED = 'expired',
}

/**
 * Refund request
 */
export interface RefundRequest {
  paymentId: string; // Gateway payment ID
  amount?: number; // Partial refund amount in cents (optional, full refund if omitted)
  reason?: string; // Refund reason
}

/**
 * Refund response
 */
export interface RefundResponse {
  success: boolean;
  refundId: string; // Gateway refund ID
  amount: number; // Refunded amount in cents
  status: 'pending' | 'approved' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Webhook event types
 */
export enum WebhookEventType {
  PAYMENT_APPROVED = 'payment_approved',
  PAYMENT_DECLINED = 'payment_declined',
  PAYMENT_CANCELLED = 'payment_cancelled',
  PAYMENT_REFUNDED = 'payment_refunded',
  PAYMENT_CHARGEBACK = 'payment_chargeback',
  PAYMENT_EXPIRED = 'payment_expired',
}

/**
 * Webhook notification payload
 */
export interface WebhookNotification {
  eventType: WebhookEventType;
  paymentId: string;
  orderId?: string; // Internal order ID if available
  status: PaymentStatus;
  transactionAmount: number;
  paymentMethod: PaymentMethod;
  date: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Payment Gateway Adapter Interface
 *
 * Implementations of this interface must handle:
 * - Payment creation for all supported methods
 * - Payment status checking
 * - Refund processing
 * - Webhook signature verification and parsing
 */
export interface IPaymentGatewayAdapter {
  /**
   * Create a new payment
   * @param request - Payment creation request
   * @returns Payment response with payment details
   */
  createPayment(request: CreatePaymentRequest): Promise<PaymentResponse>;

  /**
   * Get payment status from gateway
   * @param paymentId - Gateway payment ID
   * @returns Current payment status and details
   */
  getPaymentStatus(paymentId: string): Promise<PaymentResponse>;

  /**
   * Process a refund (full or partial)
   * @param request - Refund request
   * @returns Refund response
   */
  refundPayment(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Verify webhook signature and parse notification
   * @param signature - Webhook signature header
   * @param payload - Raw webhook payload
   * @returns Parsed webhook notification
   * @throws Error if signature is invalid
   */
  verifyWebhook(signature: string, payload: unknown): WebhookNotification;

  /**
   * Cancel a pending payment
   * @param paymentId - Gateway payment ID
   * @returns Success status
   */
  cancelPayment(paymentId: string): Promise<boolean>;

  /**
   * Health check for gateway connection
   * @returns true if gateway is accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get gateway provider name
   */
  getProviderName(): string;
}

/**
 * Configuration for payment gateway adapters
 */
export interface PaymentGatewayConfig {
  apiKey: string;
  apiSecret: string;
  sandbox: boolean;
  webhookSecret?: string;
  baseUrl?: string; // Override default base URL
}
