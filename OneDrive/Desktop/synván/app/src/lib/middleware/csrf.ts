/**
 * CSRF Protection Middleware
 *
 * Provides Cross-Site Request Forgery protection for state-changing operations.
 * Uses token-based validation with double-submit cookie pattern.
 *
 * Environment variables:
 * - CSRF_ENABLED: Enable/disable CSRF protection (default: true)
 * - CSRF_SECRET: Secret key for token signing (required if enabled)
 *
 * Token lifecycle:
 * - Generated per session
 * - Stored in HttpOnly cookie + non-HttpOnly cookie for JS access
 * - Must be included in request header for state-changing operations
 *
 * Exemptions:
 * - GET/HEAD/OPTIONS requests (safe methods)
 * - Webhook endpoints (external callbacks)
 * - Public API endpoints (configured via whitelist)
 */

import { NextRequest, NextResponse } from 'next/server'

// CSRF configuration
const CSRF_ENABLED = process.env.CSRF_ENABLED !== 'false'
const CSRF_SECRET = process.env.CSRF_SECRET || 'change-me-in-production'
const CSRF_TOKEN_LENGTH = 32
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_COOKIE_NAME_HTTPONLY = 'csrf_token_signed'

// Routes that are exempt from CSRF protection
const CSRF_EXEMPT_ROUTES = [
  '/api/auth', // NextAuth handles its own CSRF protection
  '/api/payments/webhook', // External payment gateway callbacks
  '/api/webhooks', // Generic webhook endpoints
]

// Routes that are state-changing and require CSRF protection
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/**
 * Convert string to ArrayBuffer for Web Crypto API
 */
function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/**
 * Convert ArrayBuffer to string
 */
function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer)
}

/**
 * Generate a secure random CSRF token using Web Crypto API
 * Compatible with Edge Runtime
 */
export async function generateCSRFToken(): Promise<string> {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH)
  crypto.getRandomValues(array)
  // Convert to base64url
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Sign a CSRF token with HMAC using Web Crypto API
 * Compatible with Edge Runtime
 */
async function signCSRFToken(token: string): Promise<string> {
  const secretBytes = encodeText(CSRF_SECRET)
  const tokenBytes = encodeText(token)

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    tokenBytes.buffer as ArrayBuffer
  )

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Verify a signed CSRF token using Web Crypto API
 * Compatible with Edge Runtime
 */
async function verifyCSRFToken(token: string, signature: string): Promise<boolean> {
  try {
    const expectedSignature = await signCSRFToken(token)

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      return false
    }

    // XOR comparison for constant-time
    let result = 0
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }

    return result === 0
  } catch (error) {
    // If anything goes wrong, treat as invalid
    return false
  }
}

/**
 * Generate CSRF token pair (unsigned + signed)
 * Async version for Edge Runtime compatibility
 */
export async function generateCSRFTokenPair(): Promise<{
  token: string
  signedToken: string
}> {
  const token = await generateCSRFToken()
  const signedToken = await signCSRFToken(token)
  return { token, signedToken }
}

/**
 * Check if route is exempt from CSRF protection
 */
function isRouteExempt(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Extract CSRF token from request
 */
function extractCSRFToken(request: NextRequest): string | null {
  // Check header first (preferred method)
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (headerToken) {
    return headerToken
  }

  // Fallback to checking request body
  // Note: This requires the route handler to pass the body
  return null
}

/**
 * Validate CSRF token for a request
 * Async version for Edge Runtime compatibility
 */
export async function validateCSRFRequest(request: NextRequest): Promise<{
  valid: boolean
  error?: string
}> {
  // Skip validation if CSRF is disabled
  if (!CSRF_ENABLED) {
    return { valid: true }
  }

  // Skip validation for safe methods
  if (!CSRF_PROTECTED_METHODS.includes(request.method)) {
    return { valid: true }
  }

  // Skip validation for exempt routes
  if (isRouteExempt(request.nextUrl.pathname)) {
    return { valid: true }
  }

  // Extract tokens from cookies
  const token = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const signedToken = request.cookies.get(CSRF_COOKIE_NAME_HTTPONLY)?.value

  if (!token || !signedToken) {
    return {
      valid: false,
      error: 'Missing CSRF token. Please refresh the page and try again.',
    }
  }

  // Verify the signature
  const isValid = await verifyCSRFToken(token, signedToken)
  if (!isValid) {
    return {
      valid: false,
      error: 'Invalid CSRF token. Please refresh the page and try again.',
    }
  }

  // Extract token from request (header or body)
  const requestToken = extractCSRFToken(request)

  if (!requestToken) {
    return {
      valid: false,
      error: 'Missing CSRF token in request header.',
    }
  }

  // Verify tokens match
  if (requestToken !== token) {
    return {
      valid: false,
      error: 'CSRF token mismatch. Please refresh the page and try again.',
    }
  }

  return { valid: true }
}

/**
 * Set CSRF token cookies on response
 * Async version for Edge Runtime compatibility
 */
export async function setCSRFCookies(response: NextResponse): Promise<NextResponse> {
  if (!CSRF_ENABLED) {
    return response
  }

  const { token, signedToken } = await generateCSRFTokenPair()

  // Set unsigned token (accessible to JavaScript)
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  // Set signed token (HttpOnly for security)
  response.cookies.set(CSRF_COOKIE_NAME_HTTPONLY, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  // Add token to response header for easy retrieval
  response.headers.set(CSRF_HEADER_NAME, token)

  return response
}

/**
 * CSRF protection middleware for Next.js middleware.ts
 *
 * Usage in middleware.ts:
 * ```
 * import { csrfProtection } from '@/lib/middleware/csrf'
 *
 * export async function middleware(request: NextRequest) {
 *   const csrfResult = await csrfProtection(request)
 *   if (!csrfResult.valid) {
 *     return NextResponse.json(
 *       { error: csrfResult.error },
 *       { status: 403 }
 *     )
 *   }
 *   return NextResponse.next()
 * }
 * ```
 */
export async function csrfProtection(request: NextRequest): Promise<{
  valid: boolean
  error?: string
}> {
  return await validateCSRFRequest(request)
}

/**
 * Middleware wrapper that adds CSRF tokens to response
 * and validates tokens on state-changing requests
 * Async version for Edge Runtime compatibility
 */
export function createCSRFMiddleware() {
  return async (request: NextRequest) => {
    // Validate request
    const validation = await validateCSRFRequest(request)

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 403 }
      )
    }

    // Add CSRF tokens to response
    const response = NextResponse.next()
    return await setCSRFCookies(response)
  }
}

/**
 * Get current CSRF token from cookies
 * Useful for client-side JavaScript to retrieve the token
 */
export function getCSRFToken(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null
}

/**
 * Regenerate CSRF token (e.g., after login)
 * Async version for Edge Runtime compatibility
 */
export async function regenerateCSRFToken(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next()
  return await setCSRFCookies(response)
}
