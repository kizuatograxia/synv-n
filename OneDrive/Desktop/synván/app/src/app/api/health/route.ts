import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getRedisClient } from '@/lib/cache/redis'

/**
 * Health check endpoint for monitoring system status
 *
 * Verifies:
 * - Application is running
 * - Database connection is healthy
 * - Redis connection is healthy (if configured)
 *
 * Returns HTTP 200 if all critical services are healthy
 * Returns HTTP 200 with status "degraded" if non-critical services (Redis) are down
 * Returns HTTP 503 if any critical service is down
 */
export async function GET() {
  const checks = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown' as 'healthy' | 'unhealthy',
      redis: 'unknown' as 'healthy' | 'unhealthy' | 'not_configured',
    },
  }

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.services.database = 'healthy'
  } catch (error) {
    console.error('[Health Check] Database connection failed:', error)
    checks.services.database = 'unhealthy'
    checks.status = 'unhealthy'
  }

  // Check Redis connection (non-critical)
  try {
    const redis = getRedisClient()
    if (redis) {
      await redis.ping()
      checks.services.redis = 'healthy'
    } else {
      checks.services.redis = 'not_configured'
    }
  } catch (error) {
    console.error('[Health Check] Redis connection failed:', error)
    checks.services.redis = 'unhealthy'
    // Redis is non-critical - mark system as degraded but not unhealthy
    if (checks.status !== 'unhealthy') {
      checks.status = 'degraded'
    }
  }

  // Return appropriate status code
  // 200 for healthy or degraded (system is still functional)
  // 503 only for truly unhealthy (critical services down)
  const statusCode = checks.status === 'unhealthy' ? 503 : 200

  return NextResponse.json(checks, { status: statusCode })
}
