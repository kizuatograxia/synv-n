/**
 * Circuit Breaker Wrappers for External Services
 *
 * This module provides circuit breaker wrappers for external service calls,
 * preventing cascading failures when external services are down or slow.
 *
 * Wrapped services:
 * - Payment gateway (createPayment, refundPayment, healthCheck)
 * - Email service (sendEmail)
 * - SMS service (sendSMS)
 */

import { CircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker'

/**
 * Circuit breaker configuration for external services
 */
const CIRCUIT_CONFIG = {
  // Payment gateway: more aggressive (opens after 3 failures, 30s timeout)
  paymentGateway: {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    halfOpenMaxCalls: 2,
    loggingEnabled: true,
  },

  // Email service: moderate (opens after 5 failures, 1min timeout)
  emailService: {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenMaxCalls: 3,
    loggingEnabled: true,
  },

  // SMS service: moderate (opens after 5 failures, 1min timeout)
  smsService: {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenMaxCalls: 3,
    loggingEnabled: true,
  },
}

/**
 * Create circuit breakers for each external service
 */
const paymentGatewayBreaker = new CircuitBreaker({
  name: 'PaymentGateway',
  config: CIRCUIT_CONFIG.paymentGateway,
})

const emailServiceBreaker = new CircuitBreaker({
  name: 'EmailService',
  config: CIRCUIT_CONFIG.emailService,
})

const smsServiceBreaker = new CircuitBreaker({
  name: 'SMSService',
  config: CIRCUIT_CONFIG.smsService,
})

/**
 * Wrapper types
 */

export type WrappedFunction<T extends (...args: any[]) => Promise<any>> = T & {
  readonly _isCircuitBreakerWrapped: true
}

/**
 * Check if an error is a circuit breaker open error
 */
export function isCircuitBreakerError(error: unknown): boolean {
  return error instanceof CircuitBreakerOpenError
}

/**
 * Wrap a payment gateway call with circuit breaker
 *
 * @param fn - The async function to wrap
 * @returns The wrapped function that will fail fast when circuit is open
 *
 * @example
 * ```ts
 * const createPayment = withPaymentCircuitBreaker(async (request) => {
 *   return await adapter.createPayment(request)
 * })
 * ```
 */
export function withPaymentCircuitBreaker<
  T extends (...args: any[]) => Promise<any>
>(fn: T): WrappedFunction<T> {
  const wrapped = (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return paymentGatewayBreaker.execute(() => fn(...args))
  }) as T & { _isCircuitBreakerWrapped: true }

  wrapped._isCircuitBreakerWrapped = true as const
  return wrapped
}

/**
 * Wrap an email service call with circuit breaker
 *
 * @param fn - The async function to wrap
 * @returns The wrapped function that will fail fast when circuit is open
 *
 * @example
 * ```ts
 * const sendEmail = withEmailCircuitBreaker(async (email) => {
 *   return await emailService.send(email)
 * })
 * ```
 */
export function withEmailCircuitBreaker<
  T extends (...args: any[]) => Promise<any>
>(fn: T): WrappedFunction<T> {
  const wrapped = (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return emailServiceBreaker.execute(() => fn(...args))
  }) as T & { _isCircuitBreakerWrapped: true }

  wrapped._isCircuitBreakerWrapped = true as const
  return wrapped
}

/**
 * Wrap an SMS service call with circuit breaker
 *
 * @param fn - The async function to wrap
 * @returns The wrapped function that will fail fast when circuit is open
 *
 * @example
 * ```ts
 * const sendSMS = withSMSCircuitBreaker(async (message) => {
 *   return await smsService.send(message)
 * })
 * ```
 */
export function withSMSCircuitBreaker<
  T extends (...args: any[]) => Promise<any>
>(fn: T): WrappedFunction<T> {
  const wrapped = (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return smsServiceBreaker.execute(() => fn(...args))
  }) as T & { _isCircuitBreakerWrapped: true }

  wrapped._isCircuitBreakerWrapped = true as const
  return wrapped
}

/**
 * Get circuit breaker stats for monitoring
 */
export function getCircuitBreakerStats() {
  return {
    paymentGateway: paymentGatewayBreaker.getStats(),
    emailService: emailServiceBreaker.getStats(),
    smsService: smsServiceBreaker.getStats(),
  }
}

/**
 * Manually reset a circuit breaker (for recovery operations)
 */
export function resetCircuitBreaker(service: 'paymentGateway' | 'emailService' | 'smsService') {
  switch (service) {
    case 'paymentGateway':
      paymentGatewayBreaker.reset()
      break
    case 'emailService':
      emailServiceBreaker.reset()
      break
    case 'smsService':
      smsServiceBreaker.reset()
      break
  }
}

/**
 * Manually open a circuit breaker (for testing or emergency shutdown)
 */
export function openCircuitBreaker(service: 'paymentGateway' | 'emailService' | 'smsService') {
  switch (service) {
    case 'paymentGateway':
      paymentGatewayBreaker.open()
      break
    case 'emailService':
      emailServiceBreaker.open()
      break
    case 'smsService':
      smsServiceBreaker.open()
      break
  }
}
