/**
 * Notification Service Factory
 *
 * This module provides factory functions to create the appropriate notification services
 * based on the EMAIL_PROVIDER and SMS_PROVIDER environment variables.
 *
 * Supported email providers:
 * - smtp: Default, uses nodemailer with SMTP
 * - sendgrid: Uses SendGrid API (TODO)
 * - ses: Uses AWS SES (TODO)
 * - mailgun: Uses Mailgun API (TODO)
 *
 * Supported SMS providers:
 * - twilio: Uses Twilio API
 * - vonage: Uses Vonage API (TODO)
 */

import { IEmailService } from './types';
import { createSMTPAdapter } from './adapters/smtp';
import { ISmsService } from './sms-service';
import { createTwilioAdapter } from './adapters/twilio';

/**
 * Get email service instance based on environment configuration
 *
 * @throws Error if EMAIL_PROVIDER is invalid
 */
export function getEmailService(): IEmailService {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  switch (provider.toLowerCase()) {
    case 'smtp':
      return createSMTPAdapter();

    case 'sendgrid':
      // TODO: Implement SendGrid adapter
      throw new Error('SendGrid adapter not yet implemented. Use SMTP or implement the adapter.');

    case 'ses':
      // TODO: Implement AWS SES adapter
      throw new Error('AWS SES adapter not yet implemented. Use SMTP or implement the adapter.');

    case 'mailgun':
      // TODO: Implement Mailgun adapter
      throw new Error('Mailgun adapter not yet implemented. Use SMTP or implement the adapter.');

    default:
      throw new Error(
        `Invalid EMAIL_PROVIDER: ${provider}. Must be one of: smtp, sendgrid, ses, mailgun`
      );
  }
}

/**
 * Get SMS service instance based on environment configuration
 *
 * @throws Error if SMS_PROVIDER is invalid
 */
export function getSmsService(): ISmsService {
  const provider = process.env.SMS_PROVIDER || 'twilio';

  switch (provider.toLowerCase()) {
    case 'twilio':
      return createTwilioAdapter();

    case 'vonage':
      // TODO: Implement Vonage adapter
      throw new Error('Vonage adapter not yet implemented. Use Twilio or implement the adapter.');

    default:
      throw new Error(
        `Invalid SMS_PROVIDER: ${provider}. Must be one of: twilio, vonage`
      );
  }
}

/**
 * Re-export types for convenience
 */
export * from './types';
export * from './sms-service';
export * from './templates';
