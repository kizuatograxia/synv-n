/**
 * Circuit Breaker Implementation
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when calling external services. The circuit breaker has three states:
 *
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fast-fail immediately
 * - HALF_OPEN: Testing if service has recovered, limited requests allowed
 *
 * State transitions:
 * - CLOSED -> OPEN: After failureThreshold consecutive failures
 * - OPEN -> HALF_OPEN: After resetTimeout has elapsed
 * - HALF_OPEN -> CLOSED: After halfOpenMaxCalls successful requests
 * - HALF_OPEN -> OPEN: On any failure
 */

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string = 'Circuit breaker is OPEN') {
    super(message)
    this.name = 'CircuitBreakerOpenError'
  }
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit (default: 5) */
  failureThreshold?: number
  /** Milliseconds to wait before attempting recovery (default: 60000 = 1 minute) */
  resetTimeout?: number
  /** Maximum allowed calls in HALF_OPEN state (default: 3) */
  halfOpenMaxCalls?: number
  /** Enable logging (default: false) */
  loggingEnabled?: boolean
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  openedAt?: Date
  nextAttemptTime?: Date
  halfOpenCallCount: number
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  name: string
  config?: CircuitBreakerConfig
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxCalls: 3,
  loggingEnabled: false,
}

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private readonly name: string
  private readonly config: Required<CircuitBreakerConfig>

  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private openedAt?: Date
  private nextAttemptTime?: Date
  private halfOpenCallCount: number = 0

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name
    this.config = { ...DEFAULT_CONFIG, ...options.config }
    this.log('Circuit breaker initialized', { state: this.state, config: this.config })
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should attempt to transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN && this.shouldAttemptReset()) {
      this.transitionToHalfOpen()
    }

    // Fast-fail if circuit is OPEN
    if (this.state === CircuitState.OPEN) {
      this.log('Circuit is OPEN, fast-failing')
      throw new CircuitBreakerOpenError(`Circuit breaker '${this.name}' is OPEN`)
    }

    // Check HALF_OPEN call limit
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        this.log('HALF_OPEN call limit reached, fast-failing')
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' HALF_OPEN call limit reached`
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++
    this.lastSuccessTime = new Date()
    this.log('Execution succeeded', {
      state: this.state,
      successCount: this.successCount,
    })

    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success in CLOSED state
        this.failureCount = 0
        break

      case CircuitState.HALF_OPEN:
        this.halfOpenCallCount++
        // Close circuit after reaching successful call limit in HALF_OPEN
        if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
          this.transitionToClosed()
        }
        break

      case CircuitState.OPEN:
        // Should not reach here, but handle gracefully
        break
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()
    this.log('Execution failed', {
      state: this.state,
      failureCount: this.failureCount,
    })

    switch (this.state) {
      case CircuitState.CLOSED:
        // Open circuit after reaching failure threshold
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionToOpen()
        }
        break

      case CircuitState.HALF_OPEN:
        // Immediately open circuit on any failure in HALF_OPEN
        this.transitionToOpen()
        break

      case CircuitState.OPEN:
        // Should not reach here, but handle gracefully
        break
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN
    this.openedAt = new Date()
    this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout)
    this.halfOpenCallCount = 0
    this.log('Circuit transitioned to OPEN', {
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
    })
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN
    this.halfOpenCallCount = 0
    this.log('Circuit transitioned to HALF_OPEN')
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.openedAt = undefined
    this.nextAttemptTime = undefined
    this.halfOpenCallCount = 0
    this.log('Circuit transitioned to CLOSED')
  }

  /**
   * Check if enough time has passed to attempt reset from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return false
    }
    return Date.now() >= this.nextAttemptTime.getTime()
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      nextAttemptTime: this.nextAttemptTime,
      halfOpenCallCount: this.halfOpenCallCount,
    }
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === CircuitState.CLOSED
  }

  /**
   * Manually reset circuit to CLOSED state
   */
  reset(): void {
    this.transitionToClosed()
    this.failureCount = 0
    this.successCount = 0
    this.lastFailureTime = undefined
    this.lastSuccessTime = undefined
    this.log('Circuit manually reset to CLOSED')
  }

  /**
   * Manually open circuit
   */
  open(): void {
    if (this.state !== CircuitState.OPEN) {
      this.transitionToOpen()
    }
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, data?: any): void {
    if (this.config.loggingEnabled) {
      console.log(`[CircuitBreaker:${this.name}] ${message}`, data || '')
    }
  }
}

/**
 * Factory function to create a circuit breaker
 */
export function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker {
  return new CircuitBreaker({
    name: options?.name || 'DefaultCircuitBreaker',
    config: options?.config,
  })
}

/**
 * Type guard to check if error is a CircuitBreakerOpenError
 */
export function isCircuitBreakerOpenError(error: unknown): error is CircuitBreakerOpenError {
  return error instanceof CircuitBreakerOpenError
}
