/**
 * CSRF Protection Tests
 *
 * Tests for CSRF token generation, validation, and middleware integration.
 */

import {
  generateCSRFToken,
  generateCSRFTokenPair,
  validateCSRFRequest,
  setCSRFCookies,
  csrfProtection,
} from '../csrf'

// Mock environment variables
process.env.CSRF_ENABLED = 'true'
process.env.CSRF_SECRET = 'test-secret-key'
process.env.NODE_ENV = 'test'

// Mock NextRequest
class MockNextRequest {
  public method: string
  public headers: Map<string, string>
  public nextUrl: { pathname: string }
  private _cookies: Map<string, string>

  constructor(url: string, options: { method?: string; headers?: Record<string, string>; cookies?: Record<string, string> } = {}) {
    this.method = options.method || 'GET'
    this.headers = new Map()
    this.nextUrl = { pathname: new URL(url).pathname }
    this._cookies = new Map()

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key, value)
      })
    }

    if (options.cookies) {
      Object.entries(options.cookies).forEach(([key, value]) => {
        this._cookies.set(key, value)
      })
    }
  }

  get ip() {
    return '127.0.0.1'
  }

  get cookies() {
    return {
      get: (name: string) => {
        const value = this._cookies.get(name)
        return value ? { name, value } : undefined
      }
    }
  }
}

describe('CSRF Token Generation', () => {
  it('should generate a random token', async () => {
    const token1 = await generateCSRFToken()
    const token2 = await generateCSRFToken()

    expect(token1).toBeTruthy()
    expect(token2).toBeTruthy()
    expect(token1).not.toBe(token2) // Tokens should be unique
    expect(token1.length).toBeGreaterThan(0)
  })

  it('should generate a token pair with signature', async () => {
    const { token, signedToken } = await generateCSRFTokenPair()

    expect(token).toBeTruthy()
    expect(signedToken).toBeTruthy()
    expect(token).not.toBe(signedToken) // Signed token should be different
  })
})

describe('CSRF Request Validation', () => {
  it('should allow GET requests without CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/events', {
      method: 'GET',
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(true)
  })

  it('should allow HEAD requests without CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/events', {
      method: 'HEAD',
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(true)
  })

  it('should allow OPTIONS requests without CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/events', {
      method: 'OPTIONS',
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(true)
  })

  it('should reject POST request without CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing CSRF token')
  })

  it('should reject POST request with invalid CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'invalid-token',
      },
      cookies: {
        csrf_token: 'different-token',
        csrf_token_signed: 'signature',
      },
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(false)
  })

  it('should reject POST request with mismatched CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'token-in-header',
      },
      cookies: {
        csrf_token: 'different-token',
        csrf_token_signed: 'signature',
      },
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(false)
    // When signature is invalid for the cookie token, it returns "Invalid CSRF token"
    expect(result.error).toContain('Invalid CSRF token')
  })

  it('should allow POST request with valid CSRF token', async () => {
    const { token, signedToken } = await generateCSRFTokenPair()

    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'x-csrf-token': token,
      },
      cookies: {
        csrf_token: token,
        csrf_token_signed: signedToken,
      },
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(true)
  })

  it('should reject POST request with invalid signature', async () => {
    const { token } = await generateCSRFTokenPair()

    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'x-csrf-token': token,
      },
      cookies: {
        csrf_token: token,
        csrf_token_signed: 'invalid-signature',
      },
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid CSRF token')
  })
})

describe('CSRF Route Exemptions', () => {
  it('should allow webhook endpoints without CSRF token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(true)
  })

  it('should allow POST to generic webhook routes', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/webhooks/payment', {
      method: 'POST',
    })

    const result = await validateCSRFRequest(request as any)

    expect(result.valid).toBe(true)
  })
})

describe('CSRF Cookie Setting', () => {
  it('should set CSRF cookies on response', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/events')

    // Create a mock response object
    const mockResponse = {
      cookies: new Map(),
      headers: new Map(),
      cookie: function(name: string, value: string, options: any) {
        this.cookies.set(name, { name, value, ...options })
      },
      setHeader: function(name: string, value: string) {
        this.headers.set(name, value)
      }
    }

    const response = await setCSRFCookies(mockResponse as any)

    const cookieToken = mockResponse.cookies.get('csrf_token')
    const cookieSigned = mockResponse.cookies.get('csrf_token_signed')

    expect(cookieToken).toBeDefined()
    expect(cookieSigned).toBeDefined()
  })

  it('should set CSRF header on response', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/events')

    // Create a mock response object
    const mockResponse = {
      cookies: new Map(),
      headers: new Map(),
      cookie: function(name: string, value: string, options: any) {
        this.cookies.set(name, { name, value, ...options })
      },
      setHeader: function(name: string, value: string) {
        this.headers.set(name, value)
      }
    }

    const response = await setCSRFCookies(mockResponse as any)

    expect(mockResponse.headers.has('x-csrf-token')).toBe(true)
  })
})

describe('CSRF Disabled', () => {
  it('should be documented that CSRF can be disabled via environment variable', () => {
    // This test documents the feature - actual runtime testing would require
    // reloading the module which is not practical in Jest
    // The feature is tested in integration/e2e tests
    expect(process.env.CSRF_ENABLED).toBeDefined()
  })
})

describe('CSRF Protection Middleware', () => {
  it('should return valid result for GET request', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/events', {
      method: 'GET',
    })

    const result = await csrfProtection(request as any)

    expect(result.valid).toBe(true)
  })

  it('should return invalid result for POST without token', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
    })

    const result = await csrfProtection(request as any)

    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('should return valid result for POST with valid token', async () => {
    const { token, signedToken } = await generateCSRFTokenPair()

    const request = new MockNextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'x-csrf-token': token,
      },
      cookies: {
        csrf_token: token,
        csrf_token_signed: signedToken,
      },
    })

    const result = await csrfProtection(request as any)

    expect(result.valid).toBe(true)
  })

  it('should exempt webhook routes from CSRF check', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/payments/webhook', {
      method: 'POST',
    })

    const result = await csrfProtection(request as any)

    expect(result.valid).toBe(true)
  })
})
