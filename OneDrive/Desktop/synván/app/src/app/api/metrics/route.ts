import { NextResponse } from 'next/server'
import { getMetrics, formatUptime } from '@/lib/middleware/metrics'

/**
 * Metrics endpoint for monitoring
 *
 * Returns request counts, error rates, and system uptime
 * This provides basic observability for production monitoring
 */
export async function GET() {
  const metrics = getMetrics()
  const uptime = Date.now() - new Date(metrics.startTime).getTime()
  const uptimeSeconds = Math.floor(uptime / 1000)

  const response = {
    uptime: {
      seconds: uptimeSeconds,
      human: formatUptime(uptimeSeconds),
    },
    requests: {
      total: metrics.requests.total,
      byRoute: metrics.requests.byRoute,
      byMethod: metrics.requests.byMethod,
      byStatus: metrics.requests.byStatus,
      ratePerSecond: uptimeSeconds > 0
        ? parseFloat((metrics.requests.total / uptimeSeconds).toFixed(2))
        : 0,
    },
    errors: {
      total: metrics.errors.total,
      byRoute: metrics.errors.byRoute,
      rate: metrics.requests.total > 0
        ? parseFloat(((metrics.errors.total / metrics.requests.total) * 100).toFixed(2))
        : 0,
    },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
