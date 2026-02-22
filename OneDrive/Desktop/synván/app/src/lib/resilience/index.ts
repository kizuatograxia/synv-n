/**
 * Resilience patterns for external service calls
 *
 * This module provides patterns for handling failures in external dependencies:
 * - Circuit Breaker: Prevent cascading failures by fast-failing unhealthy services
 */

export {
  CircuitBreaker,
  CircuitBreakerOpenError,
  CircuitState,
  createCircuitBreaker,
  isCircuitBreakerOpenError,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitBreakerOptions,
} from './circuit-breaker'
