/**
 * Email Notification Types
 *
 * This module defines the types and interfaces for the email notification system,
 * allowing the platform to send transactional emails through different providers
 * (SendGrid, AWS SES, Mailgun, SMTP) without changing the core notification logic.
 *
 * Email types supported:
 * - Ticket purchase confirmation
 * - Ticket QR code delivery
 * - Event reminders
 * - Password reset
 * - Order status updates
 */

/**
 * Email recipient information
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer; // Base64 string or Buffer
  contentType?: string;
}

/**
 * Base email interface
 */
export interface Email {
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient | EmailRecipient[];
  bcc?: EmailRecipient | EmailRecipient[];
  subject: string;
  htmlBody: string;
  textBody?: string; // Plain text fallback
  attachments?: EmailAttachment[];
  tags?: Record<string, string>; // For tracking and categorization
}

/**
 * Ticket purchase confirmation email data
 */
export interface TicketConfirmationData {
  recipientName: string;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  orderId: string;
  tickets: {
    ticketName: string;
    quantity: number;
    unitPrice: number; // In cents
    qrCodeUrl?: string; // QR code for this specific ticket
  }[];
  totalAmount: number; // In cents
  paymentMethod: string;
  orderUrl: string;
}

/**
 * Event reminder email data
 */
export interface EventReminderData {
  recipientName: string;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  ticketCount: number;
  calendarInviteUrl?: string;
  eventUrl: string;
}

/**
 * Password reset email data
 */
export interface PasswordResetData {
  recipientName: string;
  resetLink: string;
  expiryHours: number;
}

/**
 * Order status update email data
 */
export interface OrderStatusUpdateData {
  recipientName: string;
  eventName: string;
  orderId: string;
  oldStatus: string;
  newStatus: string;
  orderUrl: string;
}

/**
 * Refund confirmation email data
 */
export interface RefundConfirmationData {
  recipientName: string;
  eventName: string;
  orderId: string;
  refundAmount: number; // In cents
  refundReason?: string;
  estimatedDepositDays: number;
}

/**
 * Email template types
 */
export enum EmailTemplate {
  TICKET_CONFIRMATION = 'ticket_confirmation',
  EVENT_REMINDER = 'event_reminder',
  PASSWORD_RESET = 'password_reset',
  ORDER_STATUS_UPDATE = 'order_status_update',
  REFUND_CONFIRMATION = 'refund_confirmation',
}

/**
 * Email send result
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string; // Provider-specific message ID
  errorCode?: string;
  errorMessage?: string;
  provider: string;
}

/**
 * Email provider configuration
 */
export interface EmailProviderConfig {
  apiKey?: string;
  region?: string; // For AWS SES
  domain?: string; // For Mailgun
  fromEmail: string;
  fromName?: string;
  sandbox?: boolean; // For testing without sending real emails
}

/**
 * Email Service Interface
 *
 * Implementations of this interface must handle:
 * - Sending transactional emails
 * - Email template rendering
 * - Error handling and retries
 * - Sandbox mode for testing
 */
export interface IEmailService {
  /**
   * Send a raw email
   * @param email - Email object with recipients, subject, and body
   * @returns Send result with message ID or error
   */
  sendEmail(email: Email): Promise<EmailSendResult>;

  /**
   * Send a ticket confirmation email
   * @param to - Recipient email
   * @param data - Ticket confirmation data
   * @returns Send result
   */
  sendTicketConfirmation(to: EmailRecipient, data: TicketConfirmationData): Promise<EmailSendResult>;

  /**
   * Send an event reminder email
   * @param to - Recipient email
   * @param data - Event reminder data
   * @returns Send result
   */
  sendEventReminder(to: EmailRecipient, data: EventReminderData): Promise<EmailSendResult>;

  /**
   * Send a password reset email
   * @param to - Recipient email
   * @param data - Password reset data
   * @returns Send result
   */
  sendPasswordReset(to: EmailRecipient, data: PasswordResetData): Promise<EmailSendResult>;

  /**
   * Send an order status update email
   * @param to - Recipient email
   * @param data - Order status update data
   * @returns Send result
   */
  sendOrderStatusUpdate(to: EmailRecipient, data: OrderStatusUpdateData): Promise<EmailSendResult>;

  /**
   * Send a refund confirmation email
   * @param to - Recipient email
   * @param data - Refund confirmation data
   * @returns Send result
   */
  sendRefundConfirmation(to: EmailRecipient, data: RefundConfirmationData): Promise<EmailSendResult>;

  /**
   * Health check for email provider connection
   * @returns true if provider is accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get email provider name
   */
  getProviderName(): string;
}

/**
 * Template rendering function type
 */
export type TemplateRenderer<T> = (data: T) => { html: string; text?: string };
