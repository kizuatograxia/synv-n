import { prisma } from '../db/prisma'
import crypto from 'crypto'

export enum RateLimitTier {
  FREE = 100,
  BASIC = 1000,
  PRO = 10000,
}

export enum RateLimitWindow {
  MINUTE = 60,
  HOUR = 3600,
  DAY = 86400,
}

export interface ApiKeyInput {
  name: string
  scopes: string[]
  tier?: RateLimitTier
}

export interface RateLimitConfig {
  requestsPerWindow: number
  windowSeconds: number
}

export class ApiService {
  static generateApiKey(): string {
    const prefix = 'simprao_'
    const key = crypto.randomBytes(32).toString('hex')
    return `${prefix}${key}`
  }

  static async createApiKey(userId: string, input: ApiKeyInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    const apiKey = this.generateApiKey()
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex')

    const tier = input.tier || RateLimitTier.FREE

    const createdKey = await prisma.apiKey.create({
      data: {
        userId,
        name: input.name,
        key: hashedKey,
        scopes: input.scopes,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    })

    return {
      id: createdKey.id,
      key: apiKey,
      tier,
      expiresAt: createdKey.expiresAt,
    }
  }

  static async getApiKeys(userId: string) {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return apiKeys.map((key) => ({
      ...key,
      key: this.generateApiKey(),
    }))
  }

  static async revokeApiKey(userId: string, keyId: string) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        user: true,
      },
    })

    if (!apiKey) {
      throw new Error('API key não encontrada')
    }

    if (apiKey.userId !== userId) {
      throw new Error('Sem permissão para revogar esta API key')
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
      },
    })

    return { success: true }
  }

  static async validateApiKey(apiKey: string): Promise<{
    valid: boolean
    userId?: string
    scopes?: string[]
  }> {
    if (!apiKey) {
      return { valid: false }
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex')

    const key = await prisma.apiKey.findFirst({
      where: {
        key: hashedKey,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!key) {
      return { valid: false }
    }

    await prisma.apiKey.update({
      where: { id: key.id },
      data: {
        lastUsedAt: new Date(),
      },
    })

    return {
      valid: true,
      userId: key.user.id,
      scopes: key.scopes,
    }
  }

  static getRateLimit(scopes: string[]): RateLimitConfig {
    if (scopes.includes('admin')) {
      return {
        requestsPerWindow: RateLimitTier.PRO,
        windowSeconds: RateLimitWindow.HOUR,
      }
    }

    if (scopes.includes('events')) {
      return {
        requestsPerWindow: RateLimitTier.BASIC,
        windowSeconds: RateLimitWindow.HOUR,
      }
    }

    return {
      requestsPerWindow: RateLimitTier.FREE,
      windowSeconds: RateLimitWindow.MINUTE,
    }
  }

  static async trackApiUsage(userId: string, endpoint: string) {
    // Note: apiUsage tracking would require a dedicated analytics table
    // For now, this is a stub implementation
    // TODO: Implement ApiUsage model and tracking
    return

    /* Future implementation when ApiUsage model exists:
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        apiUsage: true,
      },
    })

    if (!user) {
      return
    }

    const usage = user.apiUsage || {
      totalRequests: 0,
      requestsByEndpoint: {},
    }

    usage.totalRequests++
    usage.requestsByEndpoint[endpoint] =
      (usage.requestsByEndpoint[endpoint] || 0) + 1

    await prisma.user.update({
      where: { id: userId },
      data: {
        apiUsage: usage,
      },
    })
    */
  }

  static getUsageLimits(tier?: RateLimitTier) {
    const limits = {
      [RateLimitTier.FREE]: { daily: 1000, monthly: 10000 },
      [RateLimitTier.BASIC]: { daily: 10000, monthly: 100000 },
      [RateLimitTier.PRO]: { daily: 100000, monthly: 1000000 },
    }

    return limits[tier || RateLimitTier.FREE]
  }
}
