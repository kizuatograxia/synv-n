/**
 * SMS Notification Types
 *
 * This module defines the types and interfaces for the SMS notification system,
 * allowing the platform to send transactional SMS messages through different providers
 * (Twilio, Vonage) without changing the core notification logic.
 *
 * SMS types supported:
 * - Ticket purchase confirmation
 * - Event reminders
 * - Order status updates
 * - Check-in notifications
 * - Two-factor authentication codes
 */

/**
 * SMS recipient information
 */
export interface SmsRecipient {
  phoneNumber: string; // E.164 format (e.g., +5511999999999)
}

/**
 * SMS send result
 */
export interface SmsSendResult {
  success: boolean;
  messageId?: string; // Provider-specific message ID
  errorCode?: string;
  errorMessage?: string;
  provider: string;
}

/**
 * SMS provider configuration
 */
export interface SmsProviderConfig {
  accountSid?: string; // For Twilio
  authToken?: string; // For Twilio
  apiKey?: string; // For Vonage
  apiSecret?: string; // For Vonage
  fromNumber: string; // Sender phone number in E.164 format
  sandbox?: boolean; // For testing without sending real SMS
}

/**
 * Base SMS message interface
 */
export interface SmsMessage {
  to: SmsRecipient | SmsRecipient[];
  body: string;
  tags?: Record<string, string>; // For tracking and categorization
}

/**
 * Ticket purchase confirmation SMS data
 */
export interface TicketConfirmationSmsData {
  recipientName: string;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  orderId: string;
  ticketCount: number;
  orderUrl: string;
}

/**
 * Event reminder SMS data
 */
export interface EventReminderSmsData {
  recipientName: string;
  eventName: string;
  eventDate: Date;
  eventLocation: string;
  ticketCount: number;
}

/**
 * Order status update SMS data
 */
export interface OrderStatusUpdateSmsData {
  recipientName: string;
  eventName: string;
  orderId: string;
  newStatus: string;
  orderUrl: string;
}

/**
 * Two-factor authentication SMS data
 */
export interface TwoFactorAuthSmsData {
  code: string;
  expiryMinutes: number;
}

/**
 * SMS Service Interface
 *
 * Implementations of this interface must handle:
 * - Sending transactional SMS messages
 * - Error handling and retries
 * - Sandbox mode for testing
 * - Phone number validation
 */
export interface ISmsService {
  /**
   * Send a raw SMS message
   * @param message - SMS message with recipients and body
   * @returns Send result with message ID or error
   */
  sendSms(message: SmsMessage): Promise<SmsSendResult>;

  /**
   * Send a ticket confirmation SMS
   * @param to - Recipient phone number
   * @param data - Ticket confirmation data
   * @returns Send result
   */
  sendTicketConfirmation(to: SmsRecipient, data: TicketConfirmationSmsData): Promise<SmsSendResult>;

  /**
   * Send an event reminder SMS
   * @param to - Recipient phone number
   * @param data - Event reminder data
   * @returns Send result
   */
  sendEventReminder(to: SmsRecipient, data: EventReminderSmsData): Promise<SmsSendResult>;

  /**
   * Send an order status update SMS
   * @param to - Recipient phone number
   * @param data - Order status update data
   * @returns Send result
   */
  sendOrderStatusUpdate(to: SmsRecipient, data: OrderStatusUpdateSmsData): Promise<SmsSendResult>;

  /**
   * Send a two-factor authentication code
   * @param to - Recipient phone number
   * @param data - 2FA data
   * @returns Send result
   */
  sendTwoFactorAuth(to: SmsRecipient, data: TwoFactorAuthSmsData): Promise<SmsSendResult>;

  /**
   * Validate phone number format
   * @param phoneNumber - Phone number to validate
   * @returns true if valid E.164 format
   */
  validatePhoneNumber(phoneNumber: string): boolean;

  /**
   * Health check for SMS provider connection
   * @returns true if provider is accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get SMS provider name
   */
  getProviderName(): string;
}
