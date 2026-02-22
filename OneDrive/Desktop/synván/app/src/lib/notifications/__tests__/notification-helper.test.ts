/**
 * Tests for notification helper graceful degradation
 *
 * These tests verify that the notification helper:
 * - Catches errors and returns failure without throwing
 * - Handles circuit breaker errors gracefully
 */

// Mock dependencies before importing the module under test
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('../../../../lib/notifications', () => {
  const mockSendEmail = jest.fn()
  const mockSendSMS = jest.fn()

  return {
    getEmailService: () => ({
      sendTicketConfirmation: mockSendEmail,
      sendEventReminder: mockSendEmail,
      sendPasswordReset: mockSendEmail,
      sendOrderStatusUpdate: mockSendEmail,
      sendRefundConfirmation: mockSendEmail,
    }),
    getSmsService: () => ({
      sendTicketConfirmation: mockSendSMS,
      sendEventReminder: mockSendSMS,
      sendOrderStatusUpdate: mockSendSMS,
      sendTwoFactorAuth: mockSendSMS,
    }),
    // Export the mock functions for test manipulation
    __mocks: {
      mockSendEmail,
      mockSendSMS,
    },
  }
})

import { sendEmailGraceful, sendSMSGraceful } from '../notification-helper'
const { __mocks } = require('../../../../lib/notifications')

const { mockSendEmail, mockSendSMS } = __mocks

describe('notification-helper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendEmailGraceful', () => {
    it('should return success when email service succeeds', async () => {
      mockSendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      })

      const result = await sendEmailGraceful(
        'sendTicketConfirmation',
        { email: 'test@example.com', name: 'Test User' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return failure without throwing when email service fails', async () => {
      mockSendEmail.mockResolvedValue({
        success: false,
        errorCode: 'SMTP_ERROR',
        errorMessage: 'Connection refused',
      })

      const result = await sendEmailGraceful(
        'sendTicketConfirmation',
        { email: 'test@example.com', name: 'Test User' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection refused')
      // Should not throw - this is the key test for graceful degradation
    })

    it('should return failure without throwing when email circuit is open', async () => {
      mockSendEmail.mockResolvedValue({
        success: false,
        errorCode: 'CIRCUIT_OPEN',
        errorMessage: 'Email service temporarily unavailable. Queued for retry.',
      })

      const result = await sendEmailGraceful(
        'sendTicketConfirmation',
        { email: 'test@example.com', name: 'Test User' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Queued for retry')
      // Should not throw - this is the key test
    })

    it('should catch and return unexpected errors without throwing', async () => {
      mockSendEmail.mockRejectedValue(new Error('Unexpected network error'))

      const result = await sendEmailGraceful(
        'sendTicketConfirmation',
        { email: 'test@example.com', name: 'Test User' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unexpected network error')
      // Should not throw - this is the key test for graceful degradation
    })
  })

  describe('sendSMSGraceful', () => {
    it('should return success when SMS service succeeds', async () => {
      mockSendSMS.mockResolvedValue({
        success: true,
        messageId: 'sms-123',
      })

      const result = await sendSMSGraceful(
        'sendTicketConfirmation',
        { phoneNumber: '+5511999999999' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return failure without throwing when SMS service fails', async () => {
      mockSendSMS.mockResolvedValue({
        success: false,
        errorCode: 'TWILIO_ERROR',
        errorMessage: 'Invalid phone number',
      })

      const result = await sendSMSGraceful(
        'sendTicketConfirmation',
        { phoneNumber: '+5511999999999' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid phone number')
      // Should not throw
    })

    it('should catch and return unexpected errors without throwing', async () => {
      mockSendSMS.mockRejectedValue(new Error('SMS service crashed'))

      const result = await sendSMSGraceful(
        'sendTicketConfirmation',
        { phoneNumber: '+5511999999999' },
        { orderId: 'ord-123', eventName: 'Test Event' }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('SMS service crashed')
      // Should not throw - this is the key test for graceful degradation
    })
  })
})
