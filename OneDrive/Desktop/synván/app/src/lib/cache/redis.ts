/**
 * Redis Cache Connection
 *
 * Provides a singleton Redis connection for caching.
 * Handles connection errors gracefully to ensure system resilience.
 *
 * Key features:
 * - Automatic reconnection on connection loss
 * - Graceful degradation when Redis is unavailable
 * - TLS support for secure production connections
 * - Connection pooling for better performance
 */

import Redis from 'ioredis';
import { logger } from '../logger';

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  EVENT_LISTINGS: 5 * 60, // 5 minutes
  SEAT_MAP_AVAILABILITY: 30, // 30 seconds
  EVENT_DETAILS: 5 * 60, // 5 minutes
  USER_SESSIONS: 24 * 60 * 60, // 24 hours
} as const;

// Singleton instance
let redisClient: Redis | null = null;

/**
 * Get or create the Redis client singleton.
 * Returns null if Redis is not configured, allowing graceful degradation.
 */
export function getRedisClient(): Redis | null {
  // Return existing client if already initialized
  if (redisClient) {
    return redisClient;
  }

  // Check if Redis URL is configured
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    // Redis not configured - system will function without cache
    return null;
  }

  try {
    // Create Redis client with production-ready settings
    const client = new Redis(redisUrl, {
      // Enable TLS if configured
      tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,

      // Automatic reconnection settings
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,

      // Connection timeout (10 seconds)
      connectTimeout: 10000,

      // Keep-alive settings
      keepAlive: 30000,

      // Retry strategy with exponential backoff
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },

      // Handle reconnection after connection loss
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Reconnect when Redis is in read-only mode (e.g., during failover)
          return true;
        }
        return false;
      },
    });

    // Set up event handlers for monitoring
    client.on('connect', () => {
      logger.debug('[Redis] Connecting to Redis server...');
    });

    client.on('ready', () => {
      logger.info('[Redis] Connection established and ready');
    });

    client.on('error', (err) => {
      // Log but don't throw - allow system to continue without cache
      logger.error('[Redis] Connection error', { error: err.message });
    });

    client.on('close', () => {
      logger.debug('[Redis] Connection closed');
    });

    client.on('reconnecting', (delay: number) => {
      logger.warn(`[Redis] Reconnecting in ${delay}ms`);
    });

    redisClient = client;
    return redisClient;
  } catch (error) {
    // Log error but don't fail - system can function without cache
    logger.error('[Redis] Failed to create Redis client', { error });
    return null;
  }
}

/**
 * Safely close the Redis connection.
 * Should be called on application shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('[Redis] Connection closed gracefully');
    } catch (error) {
      logger.error('[Redis] Error closing connection', { error });
    } finally {
      redisClient = null;
    }
  }
}

/**
 * Generic cache get operation with graceful degradation.
 * Returns null if Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const value = await client.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error(`[Redis] Error getting key "${key}"`, { error });
    return null;
  }
}

/**
 * Generic cache set operation with graceful degradation.
 * Silently fails if Redis is unavailable.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  } catch (error) {
    logger.error(`[Redis] Error setting key "${key}"`, { error });
  }
}

/**
 * Cache delete operation with graceful degradation.
 * Silently fails if Redis is unavailable.
 */
export async function cacheDelete(key: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.del(key);
  } catch (error) {
    logger.error(`[Redis] Error deleting key "${key}"`, { error });
  }
}

/**
 * Cache invalidation by pattern.
 * Useful for clearing all cached data for a specific event or entity.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client) {
    return;
  }

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    logger.error(`[Redis] Error invalidating pattern "${pattern}"`, { error });
  }
}
