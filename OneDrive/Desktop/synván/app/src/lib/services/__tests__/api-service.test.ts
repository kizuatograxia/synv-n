import { ApiService, RateLimitTier } from '@/lib/services/api-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateApiKey', () => {
    it('should generate unique API keys', () => {
      const key1 = ApiService.generateApiKey()
      const key2 = ApiService.generateApiKey()

      expect(key1).toHaveLength(72) // 'simprao_' (8) + 64 hex chars from 32 bytes
      expect(key2).not.toBe(key1)
      expect(key1).toMatch(/^simprao_[a-f0-9]{64}$/)
    })
  })

  describe('createApiKey', () => {
    it('should create API key for user', async () => {
      const mockUser = { id: 'user1' }
      const mockKey = { id: 'key1', key: 'test-key' }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.apiKey.create as jest.Mock).mockResolvedValue(mockKey)

      const result = await ApiService.createApiKey('user1', {
        name: 'Test Key',
        scopes: ['events', 'tickets'],
      })

      expect(prisma.apiKey.create).toHaveBeenCalled()
    })
  })

  describe('getApiKeys', () => {
    it('should return API keys for user', async () => {
      const mockKeys = [
        { id: 'key1', name: 'Key 1' },
        { id: 'key2', name: 'Key 2' },
      ]

      ;(prisma.apiKey.findMany as jest.Mock).mockResolvedValue(mockKeys)

      const result = await ApiService.getApiKeys('user1')

      expect(result).toHaveLength(2)
      expect(result[0].key).toHaveLength(72) // 'simprao_' (8) + 64 hex chars
    })
  })

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      const mockKey = {
        id: 'key1',
        userId: 'user1',
      }

      ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(mockKey)
      ;(prisma.apiKey.update as jest.Mock).mockResolvedValue({
        id: 'key1',
        isActive: false,
      })

      const result = await ApiService.revokeApiKey('user1', 'key1')

      expect(result).toEqual({ success: true })
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key1' },
        data: { isActive: false },
      })
    })

    it('should throw error if user does not own key', async () => {
      const mockKey = {
        id: 'key1',
        userId: 'user2',
      }

      ;(prisma.apiKey.findUnique as jest.Mock).mockResolvedValue(mockKey)

      await expect(
        ApiService.revokeApiKey('user1', 'key1')
      ).rejects.toThrow('Sem permissão para revogar esta API key')
    })
  })

  describe('getRateLimit', () => {
    it('should return free tier rate limits', () => {
      const result = ApiService.getRateLimit([])

      expect(result.requestsPerWindow).toBe(100)
      expect(result.windowSeconds).toBe(60)
    })

    it('should return admin tier rate limits', () => {
      const result = ApiService.getRateLimit(['admin'])

      expect(result.requestsPerWindow).toBe(10000)
      expect(result.windowSeconds).toBe(3600)
    })

    it('should return basic tier rate limits', () => {
      const result = ApiService.getRateLimit(['events'])

      expect(result.requestsPerWindow).toBe(1000)
      expect(result.windowSeconds).toBe(3600)
    })
  })
})
