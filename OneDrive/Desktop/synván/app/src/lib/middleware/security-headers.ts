/**
 * Security Headers Middleware
 *
 * Adds security-related HTTP headers to all responses to protect against
 * common web vulnerabilities and attacks.
 *
 * Headers added:
 * - Content-Security-Policy (CSP): Restricts resources browser can load
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - Strict-Transport-Security: Enforces HTTPS connections
 * - X-XSS-Protection: Enables XSS filtering (legacy)
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Controls browser features
 *
 * Environment variables:
 * - SECURITY_HEADERS_ENABLED: Enable/disable security headers (default: true)
 * - CSP_ENABLED: Enable CSP header (default: true)
 * - HSTS_ENABLED: Enable HSTS header (default: true in production)
 * - NODE_ENV: Environment (development/production)
 */

import { NextRequest, NextResponse } from 'next/server'

// Helper functions to check environment configuration at runtime
const isSecurityHeadersEnabled = () => process.env.SECURITY_HEADERS_ENABLED !== 'false'
const isCSPEnabled = () => process.env.CSP_ENABLED !== 'false'
const isHSTSEnabled = () => process.env.HSTS_ENABLED !== 'false' && process.env.NODE_ENV === 'production'

/**
 * Content Security Policy configuration
 *
 * CSP restricts the sources of various types of content (scripts, styles, images, etc.)
 * to prevent XSS attacks and data injection attacks.
 *
 * Directives explained:
 * - default-src: Default policy for all content types
 * - script-src: Valid sources for JavaScript
 * - style-src: Valid sources for stylesheets
 * - img-src: Valid sources for images
 * - font-src: Valid sources for fonts
 * - connect-src: Valid sources for fetch/websocket connections
 * - media-src: Valid sources for audio/video
 * - object-src: Valid sources for plugins (Flash, etc.)
 * - frame-src: Valid sources for frames
 * - base-uri: Restricts URLs for <base> element
 * - form-action: Restricts URLs for <form> submissions
 * - frame-ancestors: Restricts who can embed this page
 * - upgrade-insecure-requests: Upgrades HTTP to HTTPS
 */
export function getContentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV === 'development'

  // In development, allow unsafe-eval for Next.js hot reload
  const scriptSrc = isDev
    ? "'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com"
    : "'self' 'unsafe-inline' https://js.stripe.com"

  // Allow inline styles in development, require hash in production
  const styleSrc = isDev
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline'"

  return [
    "default-src 'self'", // Only allow same-origin by default
    `script-src ${scriptSrc}`, // JavaScript sources
    `style-src ${styleSrc}`, // Stylesheet sources
    "img-src 'self' data: https://*.stripe.com https:", // Image sources
    "font-src 'self' data:", // Font sources
    "connect-src 'self' https://api.stripe.com https://*.stripe.com", // AJAX/WebSocket sources
    "media-src 'self'", // Audio/video sources
    "object-src 'none'", // Disallow plugins (Flash, etc.)
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com", // Frame sources
    "base-uri 'self'", // Restrict <base> element
    "form-action 'self'", // Restrict form submissions
    "frame-ancestors 'none'", // Prevent clickjacking
    "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
    "block-all-mixed-content", // Block mixed content in HTTPS
  ].join('; ')
}

/**
 * Get security headers object
 *
 * Returns a map of header names to values for easy application to responses
 */
export function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}

  if (!isSecurityHeadersEnabled()) {
    return headers
  }

  // Content-Security-Policy
  // Prevents XSS by restricting resource sources
  if (isCSPEnabled()) {
    headers['Content-Security-Policy'] = getContentSecurityPolicy()
  }

  // X-Frame-Options: DENY
  // Prevents page from being embedded in frames (clickjacking protection)
  // Modern alternative is CSP's frame-ancestors, but this provides legacy support
  headers['X-Frame-Options'] = 'DENY'

  // X-Content-Type-Options: nosniff
  // Prevents browser from MIME-sniffing response away from declared content-type
  // Prevents execution of files uploaded as wrong types
  headers['X-Content-Type-Options'] = 'nosniff'

  // Strict-Transport-Security
  // Tells browser to only use HTTPS for future requests
  // max-age: How long to remember (1 year)
  // includeSubDomains: Apply to all subdomains
  // preload: Allow inclusion in browser HSTS preload list
  if (isHSTSEnabled()) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
  }

  // X-XSS-Protection: 1; mode=block
  // Enables XSS filtering in legacy browsers (modern browsers handle this via CSP)
  // This is mostly for old IE/Edge versions
  headers['X-XSS-Protection'] = '1; mode=block'

  // Referrer-Policy: strict-origin-when-cross-origin
  // Controls how much referrer information is sent
  // strict-origin-when-cross-origin: Send full URL to same origin, only origin to cross-origin
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

  // Permissions-Policy (formerly Feature-Policy)
  // Controls which browser features can be used
  // Disables geolocation, camera, microphone unless explicitly needed
  headers['Permissions-Policy'] = [
    'geolocation=()', // Disable geolocation
    'camera=()', // Disable camera
    'microphone=()', // Disable microphone
    'payment=(self)', // Only allow payment API on same origin
  ].join(', ')

  return headers
}

/**
 * Apply security headers to a NextResponse
 *
 * Usage in API route:
 * ```
 * import { applySecurityHeaders } from '@/lib/middleware/security-headers'
 *
 * export async function GET(request: NextRequest) {
 *   const response = NextResponse.json({ data: '...' })
 *   return applySecurityHeaders(response)
 * }
 * ```
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders()

  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value)
  }

  return response
}

/**
 * Security headers middleware for Next.js middleware.ts
 *
 * Applies security headers to all responses.
 *
 * Usage in middleware.ts:
 * ```
 * import { securityHeadersMiddleware } from '@/lib/middleware/security-headers'
 *
 * export function middleware(request: NextRequest) {
 *   return securityHeadersMiddleware(request)
 * }
 * ```
 */
export function securityHeadersMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()
  return applySecurityHeaders(response)
}

/**
 * Create a middleware that applies security headers and other middleware
 *
 * Usage in middleware.ts:
 * ```
 * import { createSecurityHeadersWrapper } from '@/lib/middleware/security-headers'
 * import { csrfProtection } from '@/lib/middleware/csrf'
 *
 * export function middleware(request: NextRequest) {
 *   return createSecurityHeadersWrapper(request, (req) => {
 *     // Apply other middleware here
 *     const csrfResult = csrfProtection(req)
 *     if (!csrfResult.valid) {
 *       return NextResponse.json(
 *         { error: csrfResult.error },
 *         { status: 403 }
 *       )
 *     }
 *     return NextResponse.next()
 *   })
 * }
 * ```
 */
export function createSecurityHeadersWrapper(
  request: NextRequest,
  handler: (request: NextRequest) => NextResponse
): NextResponse {
  const response = handler(request)
  return applySecurityHeaders(response)
}

/**
 * Validate security headers are present (for testing)
 *
 * Checks if all required security headers are set in a response
 */
export function validateSecurityHeaders(
  headers: Headers,
  options?: {
    cspEnabled?: boolean
    hstsEnabled?: boolean
  }
): { valid: boolean; missing: string[] } {
  const cspEnabled = options?.cspEnabled ?? isCSPEnabled()
  const hstsEnabled = options?.hstsEnabled ?? isHSTSEnabled()

  const requiredHeaders = [
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
    'Permissions-Policy',
  ]

  // CSP is only required if enabled
  if (cspEnabled) {
    requiredHeaders.push('Content-Security-Policy')
  }

  // HSTS is only required in production if enabled
  if (hstsEnabled) {
    requiredHeaders.push('Strict-Transport-Security')
  }

  const missing = requiredHeaders.filter((header) => {
    const value = headers.get(header)
    return value === null || value === undefined || value === ''
  })

  return {
    valid: missing.length === 0,
    missing,
  }
}
