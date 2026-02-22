/**
 * Metrics collection for monitoring
 *
 * In-memory metrics store for tracking request counts, errors, and response times.
 *
 * In production, this should be replaced with a proper metrics system like:
 * - Prometheus with prom-client
 * - Datadog metrics
 * - CloudWatch metrics
 */

interface MetricsData {
  requests: {
    total: number
    byRoute: Record<string, number>
    byMethod: Record<string, number>
    byStatus: Record<string, number>
  }
  errors: {
    total: number
    byRoute: Record<string, number>
  }
  startTime: string
}

// In-memory storage (resets on server restart)
const metrics: MetricsData = {
  requests: {
    total: 0,
    byRoute: {},
    byMethod: {},
    byStatus: {},
  },
  errors: {
    total: 0,
    byRoute: {},
  },
  startTime: new Date().toISOString(),
}

/**
 * Record a request metric
 *
 * This function should be called by middleware to track requests
 */
export function recordRequest(
  route: string,
  method: string,
  status: number
): void {
  metrics.requests.total++

  // Track by route
  metrics.requests.byRoute[route] = (metrics.requests.byRoute[route] || 0) + 1

  // Track by method
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1

  // Track by status
  const statusRange = `${Math.floor(status / 100)}xx`
  metrics.requests.byStatus[statusRange] =
    (metrics.requests.byStatus[statusRange] || 0) + 1

  // Track errors
  if (status >= 400) {
    metrics.errors.total++
    metrics.errors.byRoute[route] = (metrics.errors.byRoute[route] || 0) + 1
  }
}

/**
 * Get current metrics data
 */
export function getMetrics(): MetricsData {
  return metrics
}

/**
 * Format uptime in human-readable format
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`)

  return parts.join(' ')
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  metrics.requests.total = 0
  metrics.requests.byRoute = {}
  metrics.requests.byMethod = {}
  metrics.requests.byStatus = {}
  metrics.errors.total = 0
  metrics.errors.byRoute = {}
  metrics.startTime = new Date().toISOString()
}
