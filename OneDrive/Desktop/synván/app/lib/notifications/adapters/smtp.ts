/**
 * SMTP Email Adapter
 *
 * This adapter implements the IEmailService interface using nodemailer with SMTP.
 * It's a simple, provider-agnostic solution that works with any SMTP server.
 *
 * Environment variables required:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASSWORD
 * - SMTP_FROM
 */

import nodemailer from 'nodemailer';
import {
  IEmailService,
  Email,
  EmailSendResult,
  EmailProviderConfig,
  EmailRecipient,
  TicketConfirmationData,
  EventReminderData,
  PasswordResetData,
  OrderStatusUpdateData,
  RefundConfirmationData,
} from '../types';
import { templates } from '../templates';
import { createCircuitBreaker, isCircuitBreakerOpenError } from '@/lib/resilience/circuit-breaker';

export class SMTPAdapter implements IEmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailProviderConfig;
  private fromEmail: string;
  private fromName?: string;
  private circuitBreaker = createCircuitBreaker({
    name: 'SMTPEmailService',
    config: {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      halfOpenMaxCalls: 3,
      loggingEnabled: process.env.NODE_ENV === 'development',
    },
  });

  constructor(config: EmailProviderConfig) {
    this.config = config;
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName;

    // Create SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Send a raw email
   */
  async sendEmail(email: Email): Promise<EmailSendResult> {
    return this.circuitBreaker.execute(async () => {
      try {
        // In sandbox mode, log instead of sending
        if (this.config.sandbox) {
          console.log('[SMTP Adapter - Sandbox Mode]');
          console.log('To:', email.to);
          console.log('Subject:', email.subject);
          console.log('Body:', email.htmlBody.substring(0, 200) + '...');
          return {
            success: true,
            messageId: 'sandbox-' + Date.now(),
            provider: this.getProviderName(),
          };
        }

        const info = await this.transporter.sendMail({
          from: this.fromName
            ? `"${this.fromName}" <${this.fromEmail}>`
            : this.fromEmail,
          to: Array.isArray(email.to)
            ? email.to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(', ')
            : email.to.name
            ? `${email.to.name} <${email.to.email}>`
            : email.to.email,
          cc: email.cc
            ? Array.isArray(email.cc)
              ? email.cc.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(', ')
              : email.cc.name
              ? `${email.cc.name} <${email.cc.email}>`
              : email.cc.email
            : undefined,
          bcc: email.bcc
            ? Array.isArray(email.bcc)
              ? email.bcc.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(', ')
              : email.bcc.name
              ? `${email.bcc.name} <${email.bcc.email}>`
              : email.bcc.email
            : undefined,
          subject: email.subject,
          html: email.htmlBody,
          text: email.textBody,
          attachments: email.attachments?.map((att) => ({
            filename: att.filename,
            content: att.content,
            contentType: att.contentType,
          })),
        });

        return {
          success: true,
          messageId: info.messageId,
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
          errorMessage: 'Email service temporarily unavailable',
          provider: this.getProviderName(),
        };
      }

      // Handle other errors
      console.error('SMTP send error:', error);
      return {
        success: false,
        errorCode: 'SMTP_SEND_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        provider: this.getProviderName(),
      };
    });
  }

  /**
   * Send ticket confirmation email
   */
  async sendTicketConfirmation(
    to: EmailRecipient,
    data: TicketConfirmationData
  ): Promise<EmailSendResult> {
    const { html, text } = templates.ticketConfirmation(data);

    return this.sendEmail({
      to,
      subject: `🎉 Confirmação de Compra - ${data.eventName}`,
      htmlBody: html,
      textBody: text,
      tags: {
        type: 'ticket_confirmation',
        order_id: data.orderId,
        event_name: data.eventName,
      },
    });
  }

  /**
   * Send event reminder email
   */
  async sendEventReminder(
    to: EmailRecipient,
    data: EventReminderData
  ): Promise<EmailSendResult> {
    const { html, text } = templates.eventReminder(data);

    return this.sendEmail({
      to,
      subject: `📅 Lembrete: ${data.eventName}`,
      htmlBody: html,
      textBody: text,
      tags: {
        type: 'event_reminder',
        event_name: data.eventName,
      },
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    to: EmailRecipient,
    data: PasswordResetData
  ): Promise<EmailSendResult> {
    const { html, text } = templates.passwordReset(data);

    return this.sendEmail({
      to,
      subject: '🔐 Redefinição de Senha',
      htmlBody: html,
      textBody: text,
      tags: {
        type: 'password_reset',
      },
    });
  }

  /**
   * Send order status update email
   */
  async sendOrderStatusUpdate(
    to: EmailRecipient,
    data: OrderStatusUpdateData
  ): Promise<EmailSendResult> {
    const { html, text } = templates.orderStatusUpdate(data);

    return this.sendEmail({
      to,
      subject: `📦 Atualização de Pedido - ${data.orderId}`,
      htmlBody: html,
      textBody: text,
      tags: {
        type: 'order_status_update',
        order_id: data.orderId,
        new_status: data.newStatus,
      },
    });
  }

  /**
   * Send refund confirmation email
   */
  async sendRefundConfirmation(
    to: EmailRecipient,
    data: RefundConfirmationData
  ): Promise<EmailSendResult> {
    const { html, text } = templates.refundConfirmation(data);

    return this.sendEmail({
      to,
      subject: `💰 Reembolso Confirmado - ${data.orderId}`,
      htmlBody: html,
      textBody: text,
      tags: {
        type: 'refund_confirmation',
        order_id: data.orderId,
      },
    });
  }

  /**
   * Health check for SMTP connection
   * Returns false if circuit is open, otherwise checks SMTP connectivity
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

      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP health check failed:', error);
      return false;
    }
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'smtp';
  }
}

/**
 * Create SMTP adapter from environment variables
 */
export function createSMTPAdapter(): SMTPAdapter {
  const config: EmailProviderConfig = {
    fromEmail: process.env.SMTP_FROM || 'noreply@simprao.com',
    fromName: 'Simprão',
    sandbox: process.env.NODE_ENV === 'test',
  };

  return new SMTPAdapter(config);
}
