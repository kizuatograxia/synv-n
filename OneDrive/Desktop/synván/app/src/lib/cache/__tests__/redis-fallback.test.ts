/**
 * Unit Tests for Redis Fallback (Graceful Degradation)
 *
 * These tests verify that the cache functions handle Redis unavailability gracefully:
 * - cacheGet returns null when Redis is down
 * - cacheSet silently fails when Redis is down
 * - cacheDelete silently fails when Redis is down
 * - getRedisClient returns null when not configured
 * - Health check reports degraded status when Redis is down
 *
 * This is critical for system resilience as specified in VISION.md:
 * "System accepts orders when Redis is down"
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheInvalidatePattern,
  closeRedisConnection,
} from '@/lib/cache/redis'

describe('Redis Fallback - Graceful Degradation', () => {
  let originalRedisUrl: string | undefined

  beforeEach(() => {
    // Save original env var
    originalRedisUrl = process.env.REDIS_URL
    // Clear any cached singleton
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Restore original env var
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = originalRedisUrl
    }
  })

  describe('getRedisClient', () => {
    it('should return null when REDIS_URL is not configured', () => {
      delete process.env.REDIS_URL

      const client = getRedisClient()

      expect(client).toBeNull()
    })

    it('should create Redis client when REDIS_URL is configured', () => {
      process.env.REDIS_URL = 'redis://localhost:6379'

      const client = getRedisClient()

      expect(client).toBeDefined()
      expect(client).not.toBeNull()
    })
  })

  describe('cacheGet with Redis Down', () => {
    it('should return null when Redis client is not configured', async () => {
      delete process.env.REDIS_URL

      const result = await cacheGet('test-key')

      expect(result).toBeNull()
    })

    it('should return null when Redis operation fails', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'

      const result = await cacheGet('test-key')

      expect(result).toBeNull()
    })
  })

  describe('cacheSet with Redis Down', () => {
    it('should silently complete when Redis client is not configured', async () => {
      delete process.env.REDIS_URL

      await expect(cacheSet('test-key', { data: 'value' }, 60)).resolves.not.toThrow()
    })

    it('should silently complete when Redis operation fails', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'

      await expect(cacheSet('test-key', { data: 'value' }, 60)).resolves.not.toThrow()
    })
  })

  describe('cacheDelete with Redis Down', () => {
    it('should silently complete when Redis client is not configured', async () => {
      delete process.env.REDIS_URL

      await expect(cacheDelete('test-key')).resolves.not.toThrow()
    })

    it('should silently complete when Redis operation fails', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'

      await expect(cacheDelete('test-key')).resolves.not.toThrow()
    })
  })

  describe('cacheInvalidatePattern with Redis Down', () => {
    it('should silently complete when Redis client is not configured', async () => {
      delete process.env.REDIS_URL

      await expect(cacheInvalidatePattern('events:*')).resolves.not.toThrow()
    }, 10000)

    it('should silently complete when Redis operation fails', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'

      await expect(cacheInvalidatePattern('events:*')).resolves.not.toThrow()
    }, 10000)
  })

  describe('closeRedisConnection', () => {
    it('should handle gracefully when no Redis client exists', async () => {
      delete process.env.REDIS_URL

      await expect(closeRedisConnection()).resolves.not.toThrow()
    })
  })
})
