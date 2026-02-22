/**
 * Rate Limiting Middleware
 *
 * Provides in-memory rate limiting for API endpoints to prevent abuse and DDoS attacks.
 * Uses a sliding window approach to track requests per IP address.
 *
 * For production, consider using Redis-based rate limiting for distributed systems.
 *
 * Environment variables:
 * - RATE_LIMIT_ENABLED: Enable/disable rate limiting (default: true)
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 60000 = 1 minute)
 * - RATE_LIMIT_MAX_REQUESTS: Max requests per window (default: varies by endpoint)
 */

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

interface RateLimitStore {
  count: number
  resetTime: number
  lastRequestTime: number
}

// In-memory store (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitStore>()

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

// Cleanup function to remove expired entries
function cleanupExpiredEntries() {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, value] of entries) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Start cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL)
}

/**
 * Extract client IP address from request
 */
function getClientIp(request: NextRequest): string {
  // Check various headers for IP (reverse proxy, load balancer, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback to a default identifier
  return request.ip || 'unknown'
}

/**
 * Generate a unique key for rate limiting
 */
function generateKey(identifier: string, endpoint: string): string {
  return `${identifier}:${endpoint}`
}

/**
 * Rate limit middleware factory
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (
    request: NextRequest,
    endpoint: string = request.nextUrl.pathname
  ): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number } | null> => {
    // Check if rate limiting is disabled
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return null
    }

    const clientIp = getClientIp(request)
    const key = generateKey(clientIp, endpoint)
    const now = Date.now()

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      entry = {
        count: 1,
        resetTime: now + config.windowMs,
        lastRequestTime: now,
      }
      rateLimitStore.set(key, entry)
    } else {
      // Increment count
      entry.count++
      entry.lastRequestTime = now
      rateLimitStore.set(key, entry)
    }

    const remaining = Math.max(0, config.maxRequests - entry.count)

    return {
      allowed: entry.count <= config.maxRequests,
      limit: config.maxRequests,
      remaining,
      reset: entry.resetTime,
    }
  }
}

/**
 * Rate limit configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // Auth endpoints - strict limits to prevent brute force attacks
  authRegister: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 registrations per minute
  },
  authLogin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 login attempts per minute
  },

  // Order creation - moderate limits
  orders: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 orders per minute
  },

  // Payment processing - strict limits to prevent fraud
  payments: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 payment attempts per minute
  },

  // API endpoints - general purpose
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },

  // Public endpoints - more lenient
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute
  },
}

/**
 * Apply rate limiting to an API route
 *
 * Usage in API route:
 * ```
 * import { rateLimit } from '@/lib/middleware/rate-limit'
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await rateLimit(request, 'authLogin')
 *   if (!rateLimitResult?.allowed) {
 *     return NextResponse.json(
 *       { error: 'Too many requests' },
 *       { status: 429, headers: {
 *         'X-RateLimit-Limit': rateLimitResult.limit.toString(),
 *         'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
 *         'X-RateLimit-Reset': rateLimitResult.reset.toString(),
 *         'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString()
 *       }}
 *     )
 *   }
 *   // ... rest of your route handler
 * }
 * ```
 */
export async function rateLimit(
  request: NextRequest,
  configKey: keyof typeof rateLimitConfigs
) {
  const config = rateLimitConfigs[configKey]
  const limiter = createRateLimiter(config)

  return limiter(request, configKey)
}

/**
 * Middleware-style rate limiter for Next.js middleware.ts
 *
 * Usage in middleware.ts:
 * ```
 * import { createRateLimitMiddleware } from '@/lib/middleware/rate-limit'
 *
 * export const middleware = createRateLimitMiddleware({
 *   '/api/auth/register': 'authRegister',
 *   '/api/auth/login': 'authLogin',
 *   '/api/orders': 'orders',
 *   '/api/payments/process': 'payments',
 * })
 * ```
 */
export function createRateLimitMiddleware(
  endpointConfigs: Record<string, keyof typeof rateLimitConfigs>
) {
  return async (request: NextRequest) => {
    const pathname = request.nextUrl.pathname

    // Find matching endpoint config
    const configKey = Object.keys(endpointConfigs).find((endpoint) =>
      pathname.startsWith(endpoint)
    )

    if (!configKey) {
      return NextResponse.next()
    }

    const rateLimitResult = await rateLimit(
      request,
      endpointConfigs[configKey]
    )

    if (rateLimitResult && !rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(
            (rateLimitResult.reset - Date.now()) / 1000
          )} seconds.`,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': Math.ceil(
              (rateLimitResult.reset - Date.now()) / 1000
            ).toString(),
          },
        }
      )
    }

    // Add rate limit headers to all responses
    const response = NextResponse.next()
    if (rateLimitResult) {
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      response.headers.set(
        'X-RateLimit-Remaining',
        rateLimitResult.remaining.toString()
      )
      response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())
    }

    return response
  }
}

/**
 * Reset rate limit for a specific IP (for admin purposes)
 */
export function resetRateLimit(ip: string, endpoint: string) {
  const key = generateKey(ip, endpoint)
  rateLimitStore.delete(key)
}

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStatus(ip: string, endpoint: string) {
  const key = generateKey(ip, endpoint)
  return rateLimitStore.get(key)
}
