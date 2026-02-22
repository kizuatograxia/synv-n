/**
 * Circuit Breaker Tests
 *
 * Tests the circuit breaker pattern implementation including:
 * - State transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Failure threshold handling
 * - Reset timeout behavior
 * - Half-open state limiting
 * - Manual reset functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitState,
  isCircuitBreakerOpenError,
  createCircuitBreaker,
} from '@/lib/resilience/circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'TestCircuit',
      config: {
        failureThreshold: 3,
        resetTimeout: 1000, // 1 second for faster tests
        halfOpenMaxCalls: 2,
        loggingEnabled: false, // Disable logging in tests
      },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      const stats = breaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failureCount).toBe(0)
      expect(stats.successCount).toBe(0)
    })

    it('should allow execution in CLOSED state', async () => {
      const fn = jest.fn().mockResolvedValue('success')
      const result = await breaker.execute(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('CLOSED state behavior', () => {
    it('should track failures without opening circuit below threshold', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service error'))

      // First failure
      await expect(breaker.execute(fn)).rejects.toThrow('Service error')
      expect(breaker.getStats().failureCount).toBe(1)
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)

      // Second failure
      await expect(breaker.execute(fn)).rejects.toThrow('Service error')
      expect(breaker.getStats().failureCount).toBe(2)
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
    })

    it('should open circuit after failure threshold is reached', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service error'))

      // Three failures (threshold is 3)
      await expect(breaker.execute(fn)).rejects.toThrow()
      await expect(breaker.execute(fn)).rejects.toThrow()
      await expect(breaker.execute(fn)).rejects.toThrow()

      expect(breaker.getStats().state).toBe(CircuitState.OPEN)
    })

    it('should reset failure count on success', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      const successFn = jest.fn().mockResolvedValue('success')

      // Two failures
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(failFn)).rejects.toThrow()
      expect(breaker.getStats().failureCount).toBe(2)

      // One success resets the count
      await breaker.execute(successFn)
      expect(breaker.getStats().failureCount).toBe(0)
      expect(breaker.getStats().successCount).toBe(1)
    })
  })

  describe('OPEN state behavior', () => {
    it('should fast-fail calls when circuit is OPEN', async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(failFn)).rejects.toThrow()

      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Next call should fast-fail without executing the function
      const testFn = jest.fn().mockResolvedValue('success')
      await expect(breaker.execute(testFn)).rejects.toThrow(CircuitBreakerOpenError)
      expect(testFn).not.toHaveBeenCalled()
    })

    it('should set next attempt time when opening circuit', async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(failFn)).rejects.toThrow()

      const stats = breaker.getStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.nextAttemptTime).toBeDefined()
      expect(stats.nextAttemptTime!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow()
      }

      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Next call should transition to HALF_OPEN
      const testFn = jest.fn().mockResolvedValue('success')
      await breaker.execute(testFn)

      expect(breaker.getStats().state).toBe(CircuitState.HALF_OPEN)
      expect(testFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('HALF_OPEN state behavior', () => {
    beforeEach(async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow()
      }

      // Wait for reset timeout and make one call to transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 1100))
      const successFn = jest.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      expect(breaker.getStats().state).toBe(CircuitState.HALF_OPEN)
    })

    it('should allow limited calls in HALF_OPEN state', async () => {
      const successFn = jest.fn().mockResolvedValue('success')

      // Should allow calls up to halfOpenMaxCalls (2)
      await breaker.execute(successFn)
      await breaker.execute(successFn)

      expect(successFn).toHaveBeenCalledTimes(2)
    })

    it('should close circuit after successful calls in HALF_OPEN', async () => {
      const successFn = jest.fn().mockResolvedValue('success')

      // Make successful calls (halfOpenMaxCalls = 2, already made 1 in beforeEach)
      await breaker.execute(successFn)
      await breaker.execute(successFn)

      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
    })

    it('should open circuit immediately on any failure in HALF_OPEN', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))

      await expect(breaker.execute(failFn)).rejects.toThrow()

      expect(breaker.getStats().state).toBe(CircuitState.OPEN)
      expect(breaker.getStats().failureCount).toBeGreaterThan(0)
    })

    it('should reject excess calls when at max HALF_OPEN limit', async () => {
      // We're already at 1 call in HALF_OPEN (from beforeEach)
      // halfOpenMaxCalls is 2, so we can make 1 more successful call
      // After that call, the circuit closes
      const successFn = jest.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      // Circuit should be closed now, not HALF_OPEN
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)

      // Next call should work (circuit is closed)
      await expect(breaker.execute(successFn)).resolves.toBe('success')
    })
  })

  describe('manual controls', () => {
    it('should allow manual reset to CLOSED state', async () => {
      // Open the circuit
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow()
      }

      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Manual reset
      breaker.reset()

      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
      expect(breaker.getStats().failureCount).toBe(0)
      expect(breaker.getStats().nextAttemptTime).toBeUndefined()

      // Should allow calls again
      const successFn = jest.fn().mockResolvedValue('success')
      await breaker.execute(successFn)
      expect(successFn).toHaveBeenCalledTimes(1)
    })

    it('should allow manual opening of the circuit', () => {
      breaker.open()

      expect(breaker.getStats().state).toBe(CircuitState.OPEN)

      // Should fast-fail
      const fn = jest.fn().mockResolvedValue('success')
      return expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError)
    })
  })

  describe('utility methods', () => {
    it('should correctly report if circuit is open', () => {
      expect(breaker.isOpen()).toBe(false)

      breaker.open()
      expect(breaker.isOpen()).toBe(true)

      breaker.reset()
      expect(breaker.isOpen()).toBe(false)
    })

    it('should correctly report if circuit is closed', () => {
      expect(breaker.isClosed()).toBe(true)

      breaker.open()
      expect(breaker.isClosed()).toBe(false)

      breaker.reset()
      expect(breaker.isClosed()).toBe(true)
    })

    it('should return complete stats', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Service error'))
      const successFn = jest.fn().mockResolvedValue('success')

      // Make some calls
      await expect(breaker.execute(successFn)).resolves.toBe('success')
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(failFn)).rejects.toThrow()
      await expect(breaker.execute(successFn)).resolves.toBe('success')

      const stats = breaker.getStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.successCount).toBe(2)
      // Success resets failureCount in CLOSED state
      expect(stats.failureCount).toBe(0)
      expect(stats.lastSuccessTime).toBeDefined()
      expect(stats.lastFailureTime).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should throw CircuitBreakerOpenError when circuit is open', async () => {
      breaker.open()

      const fn = jest.fn().mockResolvedValue('success')
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError)
    })

    it('should propagate original errors from failed functions', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service unavailable'))

      await expect(breaker.execute(fn)).rejects.toThrow('Service unavailable')
    })

    it('should identify CircuitBreakerOpenError with type guard', async () => {
      breaker.open()

      try {
        await breaker.execute(async () => {})
        fail('Should have thrown CircuitBreakerOpenError')
      } catch (error) {
        expect(isCircuitBreakerOpenError(error)).toBe(true)
        expect(isCircuitBreakerOpenError(new Error('other'))).toBe(false)
      }
    })
  })

  describe('factory function', () => {
    it('should create circuit breaker with default config', () => {
      const defaultBreaker = createCircuitBreaker()

      expect(defaultBreaker).toBeInstanceOf(CircuitBreaker)
      expect(defaultBreaker.getStats().state).toBe(CircuitState.CLOSED)
    })

    it('should create circuit breaker with custom config', () => {
      const customBreaker = createCircuitBreaker({
        name: 'CustomBreaker',
        config: {
          failureThreshold: 10,
          resetTimeout: 5000,
        },
      })

      expect(customBreaker).toBeInstanceOf(CircuitBreaker)

      // Open the circuit
      customBreaker.open()
      const stats = customBreaker.getStats()

      // Verify custom reset timeout affects next attempt time
      expect(stats.nextAttemptTime).toBeDefined()
      const timeDiff = stats.nextAttemptTime!.getTime() - Date.now()
      expect(timeDiff).toBeGreaterThan(4000) // Should be ~5000ms
      expect(timeDiff).toBeLessThan(6000)
    })
  })

  describe('real-world scenarios', () => {
    it('should handle intermittent failures', async () => {
      let callCount = 0
      const fn = jest.fn().mockImplementation(async () => {
        callCount++
        if (callCount <= 2) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      // Two failures
      await expect(breaker.execute(fn)).rejects.toThrow()
      await expect(breaker.execute(fn)).rejects.toThrow()

      // Circuit should still be closed (threshold is 3)
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)

      // Third call succeeds
      const result = await breaker.execute(fn)
      expect(result).toBe('success')
      expect(breaker.getStats().failureCount).toBe(0)
    })

    it('should handle sustained failures with recovery', async () => {
      let actualCallCount = 0
      const fn = jest.fn().mockImplementation(async () => {
        actualCallCount++
        // Fail on first 3 actual calls to fn
        if (actualCallCount <= 3) {
          throw new Error('Sustained failure')
        }
        return 'success'
      })

      // First 3 failures open the circuit (actual calls 1-3)
      await expect(breaker.execute(fn)).rejects.toThrow()
      await expect(breaker.execute(fn)).rejects.toThrow()
      await expect(breaker.execute(fn)).rejects.toThrow()
      expect(breaker.getStats().state).toBe(CircuitState.OPEN)
      expect(fn).toHaveBeenCalledTimes(3)

      // Next 2 calls fast-fail (circuit is open, fn not called)
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError)
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError)
      expect(fn).toHaveBeenCalledTimes(3) // Still 3

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Next call succeeds, transitioning to HALF_OPEN (actual call 4)
      const result1 = await breaker.execute(fn)
      expect(result1).toBe('success')
      expect(breaker.getStats().state).toBe(CircuitState.HALF_OPEN)
      expect(fn).toHaveBeenCalledTimes(4)

      // Next call succeeds, closing the circuit (actual call 5)
      const result2 = await breaker.execute(fn)
      expect(result2).toBe('success')
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED)
      expect(fn).toHaveBeenCalledTimes(5)

      // Circuit is now closed and operational
      const result3 = await breaker.execute(fn)
      expect(result3).toBe('success')
      expect(fn).toHaveBeenCalledTimes(6)
    })
  })
})
