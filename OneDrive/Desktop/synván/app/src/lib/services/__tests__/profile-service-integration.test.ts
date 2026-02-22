/**
 * Integration Tests for ProfileService
 *
 * These tests verify profile update functionality end-to-end:
 * - Update profile name
 * - Update profile phone
 * - Update both name and phone
 * - Handle edge cases (empty updates, invalid data)
 *
 * Note: Change password functionality is not implemented.
 * This would require:
 * 1. Password validation (current vs new password)
 * 2. Password hashing with bcrypt
 * 3. New API endpoint /api/profile/password
 * 4. Service method ProfileService.changePassword()
 * This is deferred to post-frontend-completion phase per VISION.md constraint.
 */

import { ProfileService } from '../profile-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
    },
  },
}))

describe('ProfileService Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('updateProfile', () => {
    const mockUserId = 'user123'
    const mockExistingUser = {
      id: mockUserId,
      name: 'João Silva',
      email: 'joao@example.com',
      phone: '11987654321',
      cpf: '12345678900',
      passwordHash: 'hashedpassword',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    it('should update user name successfully', async () => {
      const updatedUser = {
        ...mockExistingUser,
        name: 'João Santos',
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, {
        name: 'João Santos',
      })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { name: 'João Santos' },
      })
      expect(result).toEqual(updatedUser)
    })

    it('should update user phone successfully', async () => {
      const updatedUser = {
        ...mockExistingUser,
        phone: '11912345678',
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, {
        phone: '11912345678',
      })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { phone: '11912345678' },
      })
      expect(result).toEqual(updatedUser)
    })

    it('should update both name and phone simultaneously', async () => {
      const updates = {
        name: 'Maria Oliveira',
        phone: '21987654321',
      }

      const updatedUser = {
        ...mockExistingUser,
        ...updates,
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, updates)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: updates,
      })
      expect(result).toEqual(updatedUser)
    })

    it('should skip update when phone is empty string', async () => {
      // The service uses conditional spread: ...(updates.phone && { phone: updates.phone })
      // Empty string is falsy, so phone field is not included in update data
      const updatedUser = {
        ...mockExistingUser,
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, {
        phone: '',
      })

      // Empty string is falsy, so no phone update happens
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {}, // No fields to update
      })
      expect(result.phone).toBe(mockExistingUser.phone)
    })

    it('should handle Prisma errors gracefully', async () => {
      const prismaError = new Error('Prisma error: User not found')
      ;(prisma.user.update as jest.Mock).mockRejectedValue(prismaError)

      await expect(
        ProfileService.updateProfile(mockUserId, { name: 'New Name' })
      ).rejects.toThrow('Prisma error: User not found')
    })

    it('should handle database connection errors', async () => {
      const dbError = new Error('Database connection failed')
      ;(prisma.user.update as jest.Mock).mockRejectedValue(dbError)

      await expect(
        ProfileService.updateProfile(mockUserId, { name: 'New Name' })
      ).rejects.toThrow('Database connection failed')
    })

    it('should preserve email and cpf when updating other fields', async () => {
      const updatedUser = {
        ...mockExistingUser,
        name: 'Pedro Costa',
        phone: '31987654321',
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, {
        name: 'Pedro Costa',
        phone: '31987654321',
      })

      // Verify only name and phone are updated, not email or cpf
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          name: 'Pedro Costa',
          phone: '31987654321',
        },
      })

      // Ensure email and cpf remain unchanged
      expect(result.email).toBe(mockExistingUser.email)
      expect(result.cpf).toBe(mockExistingUser.cpf)
    })

    it('should skip update when name is empty string', async () => {
      // The service uses conditional spread: ...(updates.name && { name: updates.name })
      // Empty string is falsy, so name field is not included in update data
      const updatedUser = {
        ...mockExistingUser,
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, {
        name: '',
      })

      // Empty string is falsy, so no name update happens
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {}, // No fields to update
      })
      expect(result.name).toBe(mockExistingUser.name)
    })

    it('should handle special characters in name', async () => {
      const nameWithSpecialChars = 'José Antônio da Silva-Costa'
      const updatedUser = {
        ...mockExistingUser,
        name: nameWithSpecialChars,
      }

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

      const result = await ProfileService.updateProfile(mockUserId, {
        name: nameWithSpecialChars,
      })

      expect(result.name).toBe(nameWithSpecialChars)
    })

    it('should handle Brazilian phone number formats', async () => {
      const phoneFormats = [
        '11987654321',
        '21987654321',
        '31987654321',
        '(11) 98765-4321',
        '+55 11 98765-4321',
      ]

      for (const phone of phoneFormats) {
        const updatedUser = {
          ...mockExistingUser,
          phone,
        }

        ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser)

        const result = await ProfileService.updateProfile(mockUserId, {
          phone,
        })

        expect(result.phone).toBe(phone)
      }
    })
  })

  describe('getAttendeeProfile integration with updateProfile', () => {
    it('should reflect updated profile data when fetching profile', async () => {
      const originalUser = {
        id: 'user123',
        name: 'Original Name',
        email: 'user@example.com',
        phone: '11987654321',
        cpf: '12345678900',
        orders: [],
        tickets: [],
      }

      const updatedUser = {
        ...originalUser,
        name: 'Updated Name',
        phone: '21912345678',
      }

      // First call returns original, second returns updated
      ;(prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(originalUser as any)
        .mockResolvedValueOnce(updatedUser as any)

      ;(prisma.user.update as jest.Mock).mockResolvedValue(updatedUser as any)

      // Get original profile
      const originalProfile = await ProfileService.getAttendeeProfile('user123')
      expect(originalProfile.user.name).toBe('Original Name')

      // Update profile
      await ProfileService.updateProfile('user123', {
        name: 'Updated Name',
        phone: '21912345678',
      })

      // Get updated profile
      const updatedProfile = await ProfileService.getAttendeeProfile('user123')
      expect(updatedProfile.user.name).toBe('Updated Name')
      expect(updatedProfile.user.phone).toBe('21912345678')
    })
  })
})
