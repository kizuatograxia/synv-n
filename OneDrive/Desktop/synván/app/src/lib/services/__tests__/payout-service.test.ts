import { PayoutService } from '@/lib/services/payout-service'
import { FeeEngine } from '@/lib/fees'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    order: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    bankAccount: {
      findUnique: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/audit-service', () => ({
  auditService: {
    logPayout: jest.fn().mockResolvedValue(undefined),
  },
}))

describe('PayoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('requestPayout', () => {
    const mockUser = {
      id: 'user1',
      email: 'organizer@example.com',
      role: 'ORGANIZER',
    }

    const mockBankAccount = {
      id: 'bank1',
      userId: 'user1',
      bankName: 'NuBank',
      agency: '0001',
      account: '12345678-9',
      accountHolder: 'Organizer Name',
    }

    it('should schedule payout for 3 business days in the future (Mon->Thu)', async () => {
      const monday = new Date('2026-02-09T10:00:00Z') // Monday
      jest.setSystemTime(monday)

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(mockBankAccount)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {
        bankAccountId: 'bank1',
      })

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // Monday + 3 business days = Thursday
      // Current implementation just adds 3 calendar days (Thursday)
      // This test documents the current behavior
      expect(scheduledDate.getDay()).toBe(4) // Thursday
    })

    it('should schedule payout for 3 business days (Fri->Wed)', async () => {
      const friday = new Date('2026-02-13T10:00:00Z') // Friday
      jest.setSystemTime(friday)

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(mockBankAccount)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {
        bankAccountId: 'bank1',
      })

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // Friday + 3 business days = Wednesday (skip Sat, Sun)
      // Fri -> Mon (1) -> Tue (2) -> Wed (3)
      expect(scheduledDate.getDay()).toBe(3) // Wednesday
    })

    it('should calculate payout with bank transfer fee for non-special banks', async () => {
      const mockCalculatePayout = jest.spyOn(FeeEngine, 'calculatePayout').mockReturnValue({
        netAmount: 950,
        anticipationFee: 0,
        bankTransferFee: 7.50,
        finalPayout: 942.50,
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue({
        ...mockBankAccount,
        bankName: 'Banco do Brasil', // Not a special bank
      })
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {
        bankAccountId: 'bank1',
      })

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      expect(createCall.data.bankTransferFee).toBe(7.50)

      mockCalculatePayout.mockRestore()
    })

    it('should waive bank transfer fee for special banks', async () => {
      const mockCalculatePayout = jest.spyOn(FeeEngine, 'calculatePayout').mockReturnValue({
        netAmount: 950,
        anticipationFee: 0,
        bankTransferFee: undefined,
        finalPayout: 950,
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(mockBankAccount) // NuBank
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {
        bankAccountId: 'bank1',
      })

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      // When bankTransferFee is undefined from FeeEngine, Prisma stores it as null
      expect(createCall.data.bankTransferFee).toBeUndefined()

      mockCalculatePayout.mockRestore()
    })

    it('should calculate anticipation fee when requesting anticipation', async () => {
      const mockFeeEngine = jest.spyOn(FeeEngine, 'calculatePayout').mockReturnValue({
        netAmount: 950,
        anticipationFee: 15,
        bankTransferFee: 7.50,
        finalPayout: 927.50,
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(mockBankAccount)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {
        bankAccountId: 'bank1',
        anticipationAmount: 500,
      })

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      expect(createCall.data.anticipationAmount).toBe(500)
      expect(createCall.data.anticipationFee).toBe(15)

      mockFeeEngine.mockRestore()
    })

    it('should throw error when user has no approved sales', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 0 },
      })

      await expect(
        PayoutService.requestPayout('user1', { bankAccountId: 'bank1' })
      ).rejects.toThrow('Nenhuma venda aprovada encontrada')
    })

    it('should throw error when bank account not found', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        PayoutService.requestPayout('user1', { bankAccountId: 'nonexistent' })
      ).rejects.toThrow('Conta bancária não encontrada')
    })

    it('should log payout request for audit', async () => {
      const { auditService } = require('@/lib/services/audit-service')

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(mockBankAccount)
      ;(prisma.payout.create as jest.Mock).mockResolvedValue({
        id: 'payout1',
        finalPayout: 950,
      })

      await PayoutService.requestPayout('user1', {
        bankAccountId: 'bank1',
      })

      expect(auditService.logPayout).toHaveBeenCalledWith(
        'payout1',
        'user1',
        expect.objectContaining({
          success: true,
          amount: expect.any(Number),
        })
      )
    })
  })

  describe('calculateTotalFees', () => {
    it('should aggregate fees from all approved orders', async () => {
      const mockOrders = [
        {
          totalAmount: 100,
          tickets: [{ price: 50 }, { price: 50 }],
        },
        {
          totalAmount: 200,
          tickets: [{ price: 100 }, { price: 100 }],
        },
      ]

      ;(prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders)

      const mockCalculateFees = jest.spyOn(FeeEngine, 'calculateFeesWithAllocation')
        .mockReturnValueOnce({ totalFee: 10, allocation: { organizer: 10 } })
        .mockReturnValueOnce({ totalFee: 20, allocation: { organizer: 20 } })

      const totalFees = await PayoutService.calculateTotalFees(300)

      expect(totalFees).toBe(30)
      expect(mockCalculateFees).toHaveBeenCalledTimes(2)

      mockCalculateFees.mockRestore()
    })

    it('should return zero fees when no orders exist', async () => {
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])

      const totalFees = await PayoutService.calculateTotalFees(0)

      expect(totalFees).toBe(0)
    })
  })

  describe('getPayouts', () => {
    it('should return user payouts with event and bank details', async () => {
      const mockPayouts = [
        {
          id: 'payout1',
          totalSales: 1000,
          totalFees: 50,
          netAmount: 950,
          anticipationAmount: null,
          anticipationFee: null,
          bankTransferFee: 7.50,
          finalPayout: 942.50,
          status: 'PENDING',
          scheduledFor: new Date('2026-02-12'),
          processedAt: null,
          createdAt: new Date('2026-02-09'),
          userId: 'user1',
          eventId: 'event1',
          bankAccountId: 'bank1',
          bankAccount: {
            bankName: 'NuBank',
            account: '12345678-9',
            accountHolder: 'Organizer Name',
          },
          event: {
            id: 'event1',
            title: 'Test Event',
          },
        },
      ]

      ;(prisma.payout.findMany as jest.Mock).mockResolvedValue(mockPayouts)

      const payouts = await PayoutService.getPayouts('user1')

      expect(payouts).toHaveLength(1)
      expect(payouts[0]).toMatchObject({
        id: 'payout1',
        totalSales: 1000,
        status: 'PENDING',
        bankTransferFee: 7.50,
      })
      expect(payouts[0].event).toBeDefined()
    })

    it('should filter payouts by event ID when provided', async () => {
      ;(prisma.payout.findMany as jest.Mock).mockResolvedValue([])

      await PayoutService.getPayouts('user1', 'event1')

      expect(prisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user1',
            eventId: 'event1',
          }),
        })
      )
    })

    it('should return payouts ordered by creation date descending', async () => {
      ;(prisma.payout.findMany as jest.Mock).mockResolvedValue([])

      await PayoutService.getPayouts('user1')

      expect(prisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      )
    })
  })

  describe('approvePayout', () => {
    const mockPayout = {
      id: 'payout1',
      userId: 'user1',
      status: 'PENDING',
      finalPayout: 950,
    }

    const mockAdmin = {
      id: 'admin1',
      role: 'ADMIN',
    }

    it('should approve payout when admin requests', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue(mockPayout)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdmin)
      ;(prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'APPROVED',
      })

      const result = await PayoutService.approvePayout('payout1', 'admin1')

      expect(result.status).toBe('APPROVED')
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout1' },
        data: { status: 'APPROVED' },
      })
    })

    it('should throw error when payout not found', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        PayoutService.approvePayout('nonexistent', 'admin1')
      ).rejects.toThrow('Solicitação não encontrada')
    })

    it('should throw error when payout is not pending', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PAID',
      })

      await expect(
        PayoutService.approvePayout('payout1', 'admin1')
      ).rejects.toThrow('Solicitação não está pendente')
    })

    it('should throw error when user is not admin', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue(mockPayout)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user1',
        role: 'ORGANIZER',
      })

      await expect(
        PayoutService.approvePayout('payout1', 'user1')
      ).rejects.toThrow('Não autorizado')
    })

    it('should log payout approval for audit', async () => {
      const { auditService } = require('@/lib/services/audit-service')

      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue(mockPayout)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdmin)
      ;(prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'APPROVED',
      })

      await PayoutService.approvePayout('payout1', 'admin1')

      expect(auditService.logPayout).toHaveBeenCalledWith(
        'payout1',
        'admin1',
        expect.objectContaining({
          success: true,
          method: 'Admin approval',
        })
      )
    })
  })

  describe('cancelPayout', () => {
    const mockPayout = {
      id: 'payout1',
      userId: 'user1',
      status: 'PENDING',
      finalPayout: 950,
    }

    it('should cancel payout when user requests', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue(mockPayout)
      ;(prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'CANCELLED',
      })

      const result = await PayoutService.cancelPayout('payout1', 'user1')

      expect(result.status).toBe('CANCELLED')
      expect(prisma.payout.update).toHaveBeenCalledWith({
        where: { id: 'payout1' },
        data: { status: 'CANCELLED' },
      })
    })

    it('should throw error when payout not found', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        PayoutService.cancelPayout('nonexistent', 'user1')
      ).rejects.toThrow('Solicitação não encontrada')
    })

    it('should throw error when user is not payout owner', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        userId: 'other-user',
      })

      await expect(
        PayoutService.cancelPayout('payout1', 'user1')
      ).rejects.toThrow('Não autorizado')
    })

    it('should throw error when payout is already paid', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'PAID',
      })

      await expect(
        PayoutService.cancelPayout('payout1', 'user1')
      ).rejects.toThrow('Solicitação já processada')
    })

    it('should allow cancellation of approved payouts', async () => {
      ;(prisma.payout.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'APPROVED',
      })
      ;(prisma.payout.update as jest.Mock).mockResolvedValue({
        ...mockPayout,
        status: 'CANCELLED',
      })

      const result = await PayoutService.cancelPayout('payout1', 'user1')

      expect(result.status).toBe('CANCELLED')
    })
  })

  describe('Scheduling Logic - Business Day Calculation', () => {
    /**
     * Business Day Calculator Tests
     *
     * These tests verify that the business day calculator correctly excludes weekends
     * and Brazilian holidays when scheduling payouts.
     *
     * Business days are Monday-Friday (0-4 in JS Date).
     * Weekends (Saturday=5, Sunday=6) are skipped.
     * Brazilian holidays are also excluded.
     *
     * Examples:
     * - Monday + 3 business days = Thursday
     * - Friday + 3 business days = Wednesday (skip Sat, Sun)
     * - Saturday + 3 business days = Wednesday (treated as Monday + 3)
     */

    it('should schedule Friday payout to Wednesday (3 business days)', async () => {
      const friday = new Date('2026-02-13T10:00:00Z') // Friday
      jest.setSystemTime(friday)

      const mockUser = {
        id: 'user1',
        email: 'organizer@example.com',
        role: 'ORGANIZER',
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {})

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // Friday -> Mon(1) -> Tue(2) -> Wed(3) = Wednesday (day 3)
      expect(scheduledDate.getDay()).toBe(3) // Wednesday ✓
    })

    it('should schedule Thursday payout to Tuesday (3 business days)', async () => {
      const thursday = new Date('2026-02-12T10:00:00Z') // Thursday
      jest.setSystemTime(thursday)

      const mockUser = {
        id: 'user1',
        email: 'organizer@example.com',
        role: 'ORGANIZER',
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {})

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // Thu -> Fri(1) -> Mon(2) -> Tue(3) = Tuesday (day 2)
      expect(scheduledDate.getDay()).toBe(2) // Tuesday ✓
    })

    it('should schedule Saturday payout to Thursday (3 business days from Monday)', async () => {
      const saturday = new Date('2026-02-14T10:00:00Z') // Saturday
      jest.setSystemTime(saturday)

      const mockUser = {
        id: 'user1',
        email: 'organizer@example.com',
        role: 'ORGANIZER',
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {})

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // Sat is weekend, start counting from Mon
      // Mon -> Tue(1) -> Wed(2) -> Thu(3) = Thursday (day 4)
      expect(scheduledDate.getDay()).toBe(4) // Thursday ✓
    })

    it('should schedule Sunday payout to Thursday (3 business days from Monday)', async () => {
      const sunday = new Date('2026-02-15T10:00:00Z') // Sunday
      jest.setSystemTime(sunday)

      const mockUser = {
        id: 'user1',
        email: 'organizer@example.com',
        role: 'ORGANIZER',
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {})

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // Sun is weekend, start counting from Mon
      // Mon -> Tue(1) -> Wed(2) -> Thu(3) = Thursday (day 4)
      expect(scheduledDate.getDay()).toBe(4) // Thursday ✓
    })

    it('should skip Brazilian holidays when calculating business days', async () => {
      // April 21, 2026 is a Tuesday (Tiradentes holiday)
      const april18 = new Date('2026-04-18T10:00:00Z') // Saturday before holiday
      jest.setSystemTime(april18)

      const mockUser = {
        id: 'user1',
        email: 'organizer@example.com',
        role: 'ORGANIZER',
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(prisma.order.aggregate as jest.Mock).mockResolvedValue({
        _sum: { totalAmount: 1000 },
      })
      ;(prisma.order.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.bankAccount.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.payout.create as jest.Mock).mockImplementation((data) => ({
        id: 'payout1',
        ...data.data,
      }))

      await PayoutService.requestPayout('user1', {})

      const createCall = (prisma.payout.create as jest.Mock).mock.calls[0][0]
      const scheduledDate = new Date(createCall.data.scheduledFor)

      // April 18 (Sat) -> Mon Apr 20 -> Tue Apr 21 (Tiradentes, skip) -> Wed Apr 22 (1) -> Thu Apr 23 (2) -> Fri Apr 24 (3)
      expect(scheduledDate.getDay()).toBe(5) // Friday ✓
    })
  })
})
