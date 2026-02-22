import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { validateCSRFRequest, setCSRFCookies } from '@/lib/middleware/csrf'
import { applySecurityHeaders } from '@/lib/middleware/security-headers'
import { recordRequest } from '@/lib/middleware/metrics'
import { generateRequestId } from '@/lib/logger'
import { logger } from '@/lib/logger'
import { decode } from 'next-auth/jwt'

async function getSessionFromRequest(req: NextRequest) {
  try {
    const token = req.cookies.get('authjs.session-token')?.value ||
                  req.cookies.get('__Secure-authjs.session-token')?.value

    if (!token) return null

    const decoded = await decode({
      token,
      secret: process.env.NEXTAUTH_SECRET || '',
      salt: req.cookies.has('__Secure-authjs.session-token')
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
    })

    if (!decoded) return null

    return {
      user: {
        id: decoded.id as string,
        email: decoded.email as string,
        name: decoded.name as string,
        role: decoded.role as string,
      }
    }
  } catch (error) {
    logger.warn('Failed to decode session token', { error: String(error) })
    return null
  }
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const method = req.method
  const startTime = Date.now()

  // Generate or retrieve request ID for tracing
  const requestId = req.headers.get('x-request-id') || generateRequestId()

  // Apply CSRF protection to state-changing API endpoints
  if (path.startsWith('/api')) {
    const csrfValidation = await validateCSRFRequest(req)
    if (!csrfValidation.valid) {
      recordRequest(path, method, 403)
      logger.warn('CSRF validation failed', { requestId, path, method })
      return NextResponse.json(
        { error: csrfValidation.error },
        { status: 403 }
      )
    }
  }

  // Apply rate limiting to API endpoints
  if (path.startsWith('/api')) {
    // Determine rate limit config based on endpoint
    let rateLimitConfigKey: keyof typeof import('@/lib/middleware/rate-limit').rateLimitConfigs | null = null

    if (path === '/api/auth/register' && method === 'POST') {
      rateLimitConfigKey = 'authRegister'
    } else if (path === '/api/auth/login' && method === 'POST') {
      rateLimitConfigKey = 'authLogin'
    } else if (path.startsWith('/api/orders') && method === 'POST') {
      rateLimitConfigKey = 'orders'
    } else if (path.startsWith('/api/payments/process') && method === 'POST') {
      rateLimitConfigKey = 'payments'
    } else if (path.startsWith('/api/')) {
      rateLimitConfigKey = 'api'
    }

    // Apply rate limit if config is set
    if (rateLimitConfigKey) {
      const rateLimitResult = await rateLimit(req, rateLimitConfigKey)

      if (rateLimitResult && !rateLimitResult.allowed) {
        recordRequest(path, method, 429)
        logger.warn('Rate limit exceeded', {
          requestId,
          path,
          method,
          limit: rateLimitResult.limit,
          reset: rateLimitResult.reset,
        })
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

      // Add rate limit headers to response
      const response = NextResponse.next()
      if (rateLimitResult) {
        response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
        response.headers.set(
          'X-RateLimit-Remaining',
          rateLimitResult.remaining.toString()
        )
        response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())
      }

      // Add request ID to response for tracing
      response.headers.set('X-Request-ID', requestId)

      // Add CSRF tokens to response
      await setCSRFCookies(response)

      // Apply security headers
      applySecurityHeaders(response)

      // Record metrics after response completes
      const duration = Date.now() - startTime
      response.headers.set('X-Response-Time', `${duration}ms`)
      recordRequest(path, method, 200) // Will be updated by response interceptor

      // Log API request completion
      logger.info('API request', {
        requestId,
        path,
        method,
        duration,
      })

      // Continue with the rest of middleware
      return response
    }
  }

  const session = await getSessionFromRequest(req)

  if (path.startsWith('/dashboard') && !session) {
    recordRequest(path, method, 302)
    logger.info('Unauthenticated access redirected', { requestId, path, method })
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  if (path.startsWith('/admin') && (!session || session.user.role !== 'ADMIN')) {
    recordRequest(path, method, 302)
    logger.warn('Unauthorized admin access attempt', {
      requestId,
      path,
      method,
      userId: session?.user?.id,
      role: session?.user?.role,
    })
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (path.startsWith('/organizer') &&
      (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'ORGANIZER'))) {
    recordRequest(path, method, 302)
    logger.warn('Unauthorized organizer access attempt', {
      requestId,
      path,
      method,
      userId: session?.user?.id,
      role: session?.user?.role,
    })
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  // Add CSRF tokens and security headers to all responses
  const response = NextResponse.next()
  await setCSRFCookies(response)
  applySecurityHeaders(response)
  const duration = Date.now() - startTime
  response.headers.set('X-Response-Time', `${duration}ms`)
  response.headers.set('X-Request-ID', requestId)

  // Record metrics for successful requests
  if (path.startsWith('/api/')) {
    recordRequest(path, method, 200) // Placeholder - actual status comes from response
    logger.info('API request', {
      requestId,
      path,
      method,
      duration,
      userId: session?.user?.id,
    })
  } else {
    logger.debug('Page request', {
      requestId,
      path,
      method,
      duration,
      userId: session?.user?.id,
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
}

// Use Node.js runtime instead of Edge runtime to support Prisma and other Node.js modules
export const runtime = 'nodejs'
