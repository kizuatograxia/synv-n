/**
 * Twilio SMS Adapter
 *
 * This adapter implements the ISmsService interface using the Twilio API.
 * It sends SMS messages through Twilio's REST API.
 *
 * Environment variables required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER
 *
 * Documentation: https://www.twilio.com/docs/sms
 */

import { ISmsService, SmsSendResult, SmsProviderConfig, SmsRecipient, SmsMessage } from '../sms-service';
import {
  TicketConfirmationSmsData,
  EventReminderSmsData,
  OrderStatusUpdateSmsData,
  TwoFactorAuthSmsData,
} from '../sms-service';
import { createCircuitBreaker, isCircuitBreakerOpenError } from '@/lib/resilience/circuit-breaker';

// Twilio types (minimal definition for our use)
interface TwilioMessage {
  sid: string;
  status: string;
  errorCode?: number;
  errorMessage?: string;
}

interface TwilioClient {
  messages: {
    create(params: {
      to: string;
      from: string;
      body: string;
    }): Promise<TwilioMessage>;
  };
}

// Lazy load Twilio only when needed
let TwilioModule: any = null;

function loadTwilio(): any {
  if (!TwilioModule) {
    try {
      TwilioModule = require('twilio');
    } catch (error) {
      throw new Error('Twilio package not installed. Run: npm install twilio');
    }
  }
  return TwilioModule;
}

export class TwilioAdapter implements ISmsService {
  private client: TwilioClient | null = null;
  private config: SmsProviderConfig;
  private fromNumber: string;
  private circuitBreaker = createCircuitBreaker({
    name: 'TwilioSMSService',
    config: {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxCalls: 3,
      loggingEnabled: process.env.NODE_ENV === 'development',
    },
  });

  constructor(config: SmsProviderConfig) {
    this.config = config;
    this.fromNumber = config.fromNumber;

    // Initialize Twilio client only if not in sandbox mode
    if (!config.sandbox) {
      const Twilio = loadTwilio();
      this.client = Twilio(config.accountSid, config.authToken);
    }
  }

  /**
   * Send a raw SMS message
   */
  async sendSms(message: SmsMessage): Promise<SmsSendResult> {
    return this.circuitBreaker.execute(async () => {
      try {
        const recipients = Array.isArray(message.to) ? message.to : [message.to];

        // In sandbox mode, log instead of sending
        if (this.config.sandbox) {
          console.log('[Twilio Adapter - Sandbox Mode]');
          console.log('To:', recipients.map((r) => r.phoneNumber).join(', '));
          console.log('Body:', message.body);
          return {
            success: true,
            messageId: 'sandbox-' + Date.now(),
            provider: this.getProviderName(),
          };
        }

        if (!this.client) {
          throw new Error('Twilio client not initialized');
        }

        // Send to all recipients
        const results = await Promise.all(
          recipients.map(async (recipient) => {
            const result = await this.client!.messages.create({
              to: recipient.phoneNumber,
              from: this.fromNumber,
              body: message.body,
            });
            return result;
          })
        );

        // Check if all messages were sent successfully
        const failedMessage = results.find((msg) => msg.status === 'failed' || msg.errorCode);

        if (failedMessage) {
          throw new Error(failedMessage.errorMessage || 'Message sending failed');
        }

        return {
          success: true,
          messageId: results[0].sid,
          provider: this.getProviderName(),
        };
      } catch (error) {
        // Re-throw to let circuit breaker handle it
        throw error;
      }
    }).catch((error) => {
      // Handle circuit breaker errors
      if (isCircuitBreakerOpenError(error)) {
        return {
          success: false,
          errorCode: 'CIRCUIT_OPEN',
          errorMessage: 'SMS service temporarily unavailable',
          provider: this.getProviderName(),
        };
      }

      // Handle other errors
      console.error('Twilio send error:', error);
      return {
        success: false,
        errorCode: 'TWILIO_SEND_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        provider: this.getProviderName(),
      };
    });
  }

  /**
   * Send ticket confirmation SMS
   */
  async sendTicketConfirmation(
    to: SmsRecipient,
    data: TicketConfirmationSmsData
  ): Promise<SmsSendResult> {
    const formattedDate = data.eventDate.toLocaleString('pt-BR');
    const body = `🎉 ${data.recipientName}, seu pedido ${data.orderId} para ${data.eventName} está confirmado! ` +
      `📅 ${formattedDate} em ${data.eventLocation}. ` +
      `${data.ticketCount} ingresso(s). Acesse: ${data.orderUrl}`;

    return this.sendSms({
      to,
      body,
      tags: {
        type: 'ticket_confirmation',
        order_id: data.orderId,
        event_name: data.eventName,
      },
    });
  }

  /**
   * Send event reminder SMS
   */
  async sendEventReminder(
    to: SmsRecipient,
    data: EventReminderSmsData
  ): Promise<SmsSendResult> {
    const formattedDate = data.eventDate.toLocaleString('pt-BR');
    const body = `📅 Lembrete: ${data.eventName} acontece em ${formattedDate} em ${data.eventLocation}. ` +
      `Você tem ${data.ticketCount} ingresso(s). Não falte!`;

    return this.sendSms({
      to,
      body,
      tags: {
        type: 'event_reminder',
        event_name: data.eventName,
      },
    });
  }

  /**
   * Send order status update SMS
   */
  async sendOrderStatusUpdate(
    to: SmsRecipient,
    data: OrderStatusUpdateSmsData
  ): Promise<SmsSendResult> {
    const body = `📦 Atualização do pedido ${data.orderId} para ${data.eventName}: ` +
      `Status: ${data.newStatus}. Acesse: ${data.orderUrl}`;

    return this.sendSms({
      to,
      body,
      tags: {
        type: 'order_status_update',
        order_id: data.orderId,
        new_status: data.newStatus,
      },
    });
  }

  /**
   * Send two-factor authentication code
   */
  async sendTwoFactorAuth(
    to: SmsRecipient,
    data: TwoFactorAuthSmsData
  ): Promise<SmsSendResult> {
    const body = `🔐 Seu código de verificação é: ${data.code}. ` +
      `Válido por ${data.expiryMinutes} minutos. Não compartilhe este código.`;

    return this.sendSms({
      to,
      body,
      tags: {
        type: 'two_factor_auth',
      },
    });
  }

  /**
   * Validate phone number format (E.164)
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // E.164 format: +[country code][subscriber number]
    // Example: +5511999999999
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Health check for Twilio connection
   * Returns false if circuit is open, otherwise checks Twilio connectivity
   */
  async healthCheck(): Promise<boolean> {
    // If circuit is open, report unhealthy
    if (this.circuitBreaker.isOpen()) {
      return false;
    }

    try {
      if (this.config.sandbox) {
        return true; // Always healthy in sandbox mode
      }

      if (!this.client) {
        return false;
      }

      // Try to fetch account info as a health check
      const Twilio = loadTwilio();
      const accountClient = new Twilio(this.config.accountSid, this.config.authToken);
      await accountClient.api.accounts(this.config.accountSid).fetch();

      return true;
    } catch (error) {
      console.error('Twilio health check failed:', error);
      return false;
    }
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'twilio';
  }
}

/**
 * Create Twilio adapter from environment variables
 */
export function createTwilioAdapter(): TwilioAdapter {
  const config: SmsProviderConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
    sandbox: process.env.NODE_ENV === 'test',
  };

  if (!config.accountSid || !config.authToken || !config.fromNumber) {
    console.warn('Twilio configuration missing. SMS will not work in production.');
  }

  return new TwilioAdapter(config);
}
