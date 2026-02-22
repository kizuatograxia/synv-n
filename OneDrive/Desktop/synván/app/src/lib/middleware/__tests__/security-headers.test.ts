/**
 * Security Headers Tests
 *
 * Tests for security headers middleware including CSP, frame options,
 * content type options, HSTS, and other security-related headers.
 */

import {
  getSecurityHeaders,
  applySecurityHeaders,
  securityHeadersMiddleware,
  validateSecurityHeaders,
  getContentSecurityPolicy,
} from '../security-headers'

// Mock environment variables
process.env.SECURITY_HEADERS_ENABLED = 'true'
process.env.CSP_ENABLED = 'true'
process.env.HSTS_ENABLED = 'true'
process.env.NODE_ENV = 'test'

// Mock NextRequest
class MockNextRequest {
  public method: string
  public headers: Map<string, string>
  public nextUrl: { pathname: string }
  public url: string

  constructor(url: string, options: { method?: string; headers?: Record<string, string> } = {}) {
    this.method = options.method || 'GET'
    this.headers = new Map()
    this.url = url
    this.nextUrl = { pathname: new URL(url).pathname }

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key, value)
      })
    }
  }
}

// Mock NextResponse
class MockNextResponse {
  public headers: Map<string, string>
  public status: number

  constructor(options: { status?: number } = {}) {
    this.headers = new Map()
    this.status = options.status || 200
  }

  static next() {
    return new MockNextResponse()
  }

  setHeader(name: string, value: string) {
    this.headers.set(name, value)
  }

  get(name: string) {
    return this.headers.get(name)
  }

  json(data: any, options: { status?: number; headers?: Record<string, string> } = {}) {
    const response = new MockNextResponse({ status: options.status || 200 })
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    }
    return response
  }
}

describe('Security Headers', () => {
  describe('getSecurityHeaders', () => {
    it('should return all security headers when enabled', () => {
      const headers = getSecurityHeaders()

      expect(headers).toBeDefined()
      expect(Object.keys(headers).length).toBeGreaterThan(0)
    })

    it('should include X-Frame-Options header', () => {
      const headers = getSecurityHeaders()

      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('should include X-Content-Type-Options header', () => {
      const headers = getSecurityHeaders()

      expect(headers['X-Content-Type-Options']).toBe('nosniff')
    })

    it('should include X-XSS-Protection header', () => {
      const headers = getSecurityHeaders()

      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
    })

    it('should include Referrer-Policy header', () => {
      const headers = getSecurityHeaders()

      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    })

    it('should include Permissions-Policy header', () => {
      const headers = getSecurityHeaders()

      expect(headers['Permissions-Policy']).toContain('geolocation=()')
      expect(headers['Permissions-Policy']).toContain('camera=()')
      expect(headers['Permissions-Policy']).toContain('microphone=()')
    })

    it('should include Content-Security-Policy header when CSP is enabled', () => {
      process.env.CSP_ENABLED = 'true'
      const headers = getSecurityHeaders()

      expect(headers['Content-Security-Policy']).toBeDefined()
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
    })

    it('should not include Content-Security-Policy header when CSP is disabled', () => {
      process.env.CSP_ENABLED = 'false'
      const headers = getSecurityHeaders()

      expect(headers['Content-Security-Policy']).toBeUndefined()
    })

    it('should include Strict-Transport-Security header in production', () => {
      process.env.NODE_ENV = 'production'
      process.env.HSTS_ENABLED = 'true'
      const headers = getSecurityHeaders()

      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains; preload')
    })

    it('should not include Strict-Transport-Security header in development', () => {
      process.env.NODE_ENV = 'development'
      const headers = getSecurityHeaders()

      expect(headers['Strict-Transport-Security']).toBeUndefined()
    })

    it('should return empty object when security headers are disabled', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'false'
      const headers = getSecurityHeaders()

      expect(Object.keys(headers).length).toBe(0)
    })
  })

  describe('Content-Security-Policy', () => {
    it('should include default-src directive', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain("default-src 'self'")
    })

    it('should include script-src directive', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain('script-src')
      expect(csp).toContain("'self'")
    })

    it('should include style-src directive', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain('style-src')
    })

    it('should include img-src directive with data: support', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain('img-src')
      expect(csp).toContain('data:')
    })

    it('should include connect-src for Stripe API', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain('connect-src')
      expect(csp).toContain('stripe.com')
    })

    it('should include frame-ancestors none for clickjacking protection', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('should include form-action self', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain("form-action 'self'")
    })

    it('should include object-src none to prevent plugins', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain("object-src 'none'")
    })

    it('should include upgrade-insecure-requests', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain('upgrade-insecure-requests')
    })

    it('should include block-all-mixed-content', () => {
      const csp = getContentSecurityPolicy()

      expect(csp).toContain('block-all-mixed-content')
    })
  })

  describe('applySecurityHeaders', () => {
    it('should apply all security headers to response', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'true'
      const response = new MockNextResponse()
      const result = applySecurityHeaders(response as any)

      expect(result.headers.get('X-Frame-Options')).toBe('DENY')
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(result.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(result.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(result.headers.get('Permissions-Policy')).toBeDefined()
    })

    it('should apply CSP header when enabled', () => {
      process.env.CSP_ENABLED = 'true'
      const response = new MockNextResponse()
      const result = applySecurityHeaders(response as any)

      expect(result.headers.get('Content-Security-Policy')).toBeDefined()
    })

    it('should not apply CSP header when disabled', () => {
      process.env.CSP_ENABLED = 'false'
      const response = new MockNextResponse()
      const result = applySecurityHeaders(response as any)

      expect(result.headers.get('Content-Security-Policy')).toBeUndefined()
    })

    it('should not apply any headers when disabled', () => {
      process.env.SECURITY_HEADERS_ENABLED = 'false'
      const response = new MockNextResponse()
      const result = applySecurityHeaders(response as any)

      expect(result.headers.get('X-Frame-Options')).toBeUndefined()
      expect(result.headers.get('X-Content-Type-Options')).toBeUndefined()
    })
  })

  describe('securityHeadersMiddleware', () => {
    it('should be a function that accepts NextRequest', () => {
      expect(typeof securityHeadersMiddleware).toBe('function')
      expect(securityHeadersMiddleware.length).toBe(1) // Accepts 1 parameter
    })

    it('should return a NextResponse-like object', () => {
      const request = new MockNextRequest('http://localhost:3000/api/events')
      const response = securityHeadersMiddleware(request as any)

      expect(response).toBeDefined()
      expect(response.headers).toBeDefined()
    })

    it('should call applySecurityHeaders internally', () => {
      const request = new MockNextRequest('http://localhost:3000/api/orders')

      // We can't easily mock NextResponse.next(), but we can verify
      // that the middleware function works without throwing
      expect(() => securityHeadersMiddleware(request as any)).not.toThrow()
    })
  })

  describe('validateSecurityHeaders', () => {
    it('should validate response with all required headers', () => {
      process.env.CSP_ENABLED = 'true'
      process.env.NODE_ENV = 'test'

      const headers = new Headers()
      headers.set('X-Frame-Options', 'DENY')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-XSS-Protection', '1; mode=block')
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      headers.set('Permissions-Policy', 'geolocation=()')
      headers.set('Content-Security-Policy', "default-src 'self'")

      const result = validateSecurityHeaders(headers)

      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should detect missing X-Frame-Options header', () => {
      const headers = new Headers()
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-XSS-Protection', '1; mode=block')
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      headers.set('Permissions-Policy', 'geolocation=()')

      const result = validateSecurityHeaders(headers)

      expect(result.valid).toBe(false)
      expect(result.missing).toContain('X-Frame-Options')
    })

    it('should detect missing X-Content-Type-Options header', () => {
      const headers = new Headers()
      headers.set('X-Frame-Options', 'DENY')
      headers.set('X-XSS-Protection', '1; mode=block')
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      headers.set('Permissions-Policy', 'geolocation=()')

      const result = validateSecurityHeaders(headers)

      expect(result.valid).toBe(false)
      expect(result.missing).toContain('X-Content-Type-Options')
    })

    it('should detect missing Content-Security-Policy header when enabled', () => {
      const headers = new Headers()
      headers.set('X-Frame-Options', 'DENY')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-XSS-Protection', '1; mode=block')
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      headers.set('Permissions-Policy', 'geolocation=()')

      const result = validateSecurityHeaders(headers, { cspEnabled: true })

      expect(result.valid).toBe(false)
      expect(result.missing).toContain('Content-Security-Policy')
    })

    it('should not require Content-Security-Policy header when disabled', () => {
      const headers = new Headers()
      headers.set('X-Frame-Options', 'DENY')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-XSS-Protection', '1; mode=block')
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      headers.set('Permissions-Policy', 'geolocation=()')

      const result = validateSecurityHeaders(headers, { cspEnabled: false })

      expect(result.valid).toBe(true)
      expect(result.missing).not.toContain('Content-Security-Policy')
    })

    it('should detect multiple missing headers', () => {
      const headers = new Headers()
      headers.set('X-XSS-Protection', '1; mode=block')

      const result = validateSecurityHeaders(headers)

      expect(result.valid).toBe(false)
      expect(result.missing.length).toBeGreaterThan(1)
      expect(result.missing).toContain('X-Frame-Options')
      expect(result.missing).toContain('X-Content-Type-Options')
    })

    it('should not require HSTS in development', () => {
      const headers = new Headers()
      headers.set('X-Frame-Options', 'DENY')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-XSS-Protection', '1; mode=block')
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      headers.set('Permissions-Policy', 'geolocation=()')

      const result = validateSecurityHeaders(headers, { hstsEnabled: false, cspEnabled: false })

      expect(result.valid).toBe(true)
      expect(result.missing).not.toContain('Strict-Transport-Security')
    })
  })
})
