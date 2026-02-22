/**
 * Notification Helper Service
 *
 * This service provides graceful error handling for notifications.
 * When notification services fail (circuit breaker open, network error, etc.),
 * the error is logged but the operation continues without blocking.
 *
 * This ensures that:
 * - Orders complete even when email service is down
 * - Check-ins work even when SMS service is down
 * - Failed notifications are queued for retry when services recover
 */

import { getEmailService } from '../../../lib/notifications'
import { logger } from '../logger'

/**
 * Send email with graceful error handling
 *
 * If the email service fails (circuit breaker open, network error, etc.),
 * the error is logged and the function returns failure without throwing.
 * This ensures the calling code can continue execution.
 *
 * @param method - The email method to call (e.g., 'sendTicketConfirmation')
 * @param args - Arguments to pass to the email method
 * @returns Object indicating success/failure
 */
export async function sendEmailGraceful<T extends any[]>(
  method: keyof import('../../../lib/notifications/types').IEmailService,
  ...args: T
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailService = getEmailService()

    // Call the method dynamically
    if (typeof emailService[method] === 'function') {
      const result = await (emailService[method] as any)(...args)

      // Check if the result indicates success or if it was queued
      if (result.success) {
        return { success: true }
      }

      // If not successful but not throwing, log and continue
      // (e.g., circuit breaker open - already queued for retry)
      logger.warn(`Email ${method} failed but did not throw`, {
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      })

      return { success: false, error: result.errorMessage }
    }

    logger.error(`Email method ${method} not found on service`)
    return { success: false, error: `Method ${method} not found` }
  } catch (error) {
    // Catch any unexpected errors and log them
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`Email ${method} threw unexpected error`, { error: message })

    // Return failure without throwing to avoid blocking the caller
    return { success: false, error: message }
  }
}

/**
 * Send SMS with graceful error handling
 *
 * If the SMS service fails (circuit breaker open, network error, etc.),
 * the error is logged and the function returns failure without throwing.
 *
 * @param method - The SMS method to call (e.g., 'sendTicketConfirmation')
 * @param args - Arguments to pass to the SMS method
 * @returns Object indicating success/failure
 */
export async function sendSMSGraceful<T extends any[]>(
  method: keyof import('../../../lib/notifications/sms-service').ISmsService,
  ...args: T
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getSmsService } = await import('../../../lib/notifications')
    const smsService = getSmsService()

    // Call the method dynamically
    if (typeof smsService[method] === 'function') {
      const result = await (smsService[method] as any)(...args)

      // Check if the result indicates success or if it was queued
      if (result.success) {
        return { success: true }
      }

      // If not successful but not throwing, log and continue
      // (e.g., circuit breaker open - already queued for retry)
      logger.warn(`SMS ${method} failed but did not throw`, {
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      })

      return { success: false, error: result.errorMessage }
    }

    logger.error(`SMS method ${method} not found on service`)
    return { success: false, error: `Method ${method} not found` }
  } catch (error) {
    // Catch any unexpected errors and log them
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`SMS ${method} threw unexpected error`, { error: message })

    // Return failure without throwing to avoid blocking the caller
    return { success: false, error: message }
  }
}

/**
 * Send ticket confirmation email after successful payment
 *
 * This is a convenience wrapper for the common use case of sending
 * ticket confirmation emails after payment approval.
 *
 * @param recipientEmail - Customer's email address
 * @param recipientName - Customer's name
 * @param orderId - Order ID
 * @param eventName - Event name
 * @param eventDate - Event date/time
 * @param eventLocation - Event location
 * @param tickets - Array of tickets with QR codes
 * @param totalAmount - Total amount paid (in cents)
 * @param paymentMethod - Payment method used
 * @param orderUrl - URL to view order details
 */
export async function sendTicketConfirmationEmail(
  recipientEmail: string,
  recipientName: string,
  orderId: string,
  eventName: string,
  eventDate: Date,
  eventLocation: string,
  tickets: Array<{
    ticketName: string;
    quantity: number;
    unitPrice: number;
    qrCodeUrl?: string;
  }>,
  totalAmount: number,
  paymentMethod: string,
  orderUrl: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmailGraceful('sendTicketConfirmation', {
    email: recipientEmail,
    name: recipientName,
  }, {
    recipientName,
    eventName,
    eventDate,
    eventLocation,
    orderId,
    tickets,
    totalAmount,
    paymentMethod,
    orderUrl,
  })
}
