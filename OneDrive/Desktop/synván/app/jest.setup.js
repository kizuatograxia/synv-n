import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill for crypto.subtle in test environment
if (!global.crypto) {
  global.crypto = {}
}

if (!global.crypto.subtle) {
  global.crypto.subtle = {
    importKey: async () => ({
      algorithm: { name: 'HMAC' },
      extractable: false,
      type: 'secret',
      usages: ['sign']
    }),
    sign: async () => new Uint8Array(32)
  }
}

// Mock next-auth to avoid ES module issues
const mockNextAuth = jest.fn(() => ({
  handlers: {},
  signIn: jest.fn(),
  signOut: jest.fn(),
  auth: jest.fn(() => null),
}))

mockNextAuth.SessionProvider = ({ children }) => children
mockNextAuth.useSession = jest.fn(() => ({ data: null, status: 'unauthenticated' }))
mockNextAuth.signIn = jest.fn()
mockNextAuth.signOut = jest.fn()

jest.mock('next-auth', () => mockNextAuth, { virtual: true })

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children }) => children,
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
  signIn: jest.fn(),
  signOut: jest.fn(),
}), { virtual: true })

// Mock credentials provider - default import requires different approach
jest.mock('next-auth/providers/credentials', () => {
  return function() { return {}; }
}, { virtual: true })

// Mock IndexedDB for offline check-in tests
const mockDB = {
  objectStoreNames: {
    contains: jest.fn(() => true),
  },
  createObjectStore: jest.fn(),
  transaction: jest.fn(() => ({
    objectStore: jest.fn(() => ({
      add: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(() => Promise.resolve([])),
      put: jest.fn(),
      delete: jest.fn(),
      index: jest.fn(() => ({
        openCursor: jest.fn(() => Promise.resolve(null)),
        getAll: jest.fn(() => Promise.resolve([])),
      })),
    })),
  })),
  close: jest.fn(),
}

const mockRequest = {
  result: mockDB,
  onsuccess: null,
  onerror: null,
  readyState: 'done',
}

const mockOpenDB = jest.fn(() => mockRequest)

Object.defineProperty(global, 'indexedDB', {
  value: {
    open: mockOpenDB,
    deleteDatabase: jest.fn(),
  },
  writable: true,
})

// Mock the auth config module to prevent actual NextAuth initialization
jest.mock('@/lib/auth/config', () => ({
  auth: jest.fn(() => null),
  signIn: jest.fn(),
  signOut: jest.fn(),
  handlers: {},
}), { virtual: true })

// Mock Next.js server components for tests
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url, init) {
      this.url = url
      this.headers = new Map()
      if (init?.headers) {
        Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k, v))
      }
    }
    get header() {
      return {
        get: (name) => this.headers.get(name),
        set: (name, value) => this.headers.set(name, value),
      }
    }
  },
  NextResponse: {
    json: (body, init) => ({
      body,
      status: init?.status || 200,
      headers: new Map(Object.entries(init?.headers || {})),
    }),
    next: () => ({
      status: 200,
      headers: new Map(),
    }),
  },
}))
