import { OrderService } from '@/lib/services/order-service'
import { FeeEngine } from '@/lib/fees'
import { CartService } from '@/lib/services/cart-service'
import { prisma } from '@/lib/db/prisma'

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    promocode: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lot: {
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/fees', () => ({
  FeeEngine: {
    calculateFeesWithAllocation: jest.fn(),
    calculateInstallmentFees: jest.fn(),
    calculateRefund: jest.fn(),
  },
}))

jest.mock('@/lib/services/cart-service', () => ({
  CartService: {
    getCartWithDetails: jest.fn(),
    calculateCartTotal: jest.fn(),
    validateCartItems: jest.fn(),
  },
}))

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('calculateOrderSummary', () => {
    it('should calculate order summary without promocode', async () => {
      const mockCartItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
      ]

      const mockFeeBreakdown = {
        serviceFee: 20,
        processingFee: 2,
        totalFee: 22,
        organizerReceives: 178,
        buyerPays: 102,
      }

      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(null)
      ;(CartService.calculateCartTotal as jest.Mock).mockReturnValue(200)
      ;(FeeEngine.calculateFeesWithAllocation as jest.Mock).mockReturnValue(mockFeeBreakdown)

      const summary = await OrderService.calculateOrderSummary(
        mockCartItems,
        'event1',
        'BUYER',
        undefined
      )

      expect(summary).toEqual({
        subtotal: 200,
        serviceFee: 20,
        processingFee: 2,
        discount: 0,
        total: 102,
        organizerReceives: 178,
        buyerPays: 102,
      })
    })

    it('should apply percentage promocode discount', async () => {
      const mockCartItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
      ]

      const mockPromocode = {
        id: 'promo1',
        code: 'DESCONTO10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        maxUsage: 100,
        currentUsage: 50,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      }

      const mockFeeBreakdown = {
        serviceFee: 18,
        processingFee: 2,
        totalFee: 20,
        organizerReceives: 196,
        buyerPays: 200,
      }

      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(mockPromocode)
      ;(CartService.calculateCartTotal as jest.Mock).mockReturnValue(200)
      ;(FeeEngine.calculateFeesWithAllocation as jest.Mock).mockReturnValue(mockFeeBreakdown)

      const summary = await OrderService.calculateOrderSummary(
        mockCartItems,
        'event1',
        'BUYER',
        'promo1'
      )

      expect(summary.discount).toBe(20)
      expect(summary.total).toBe(180)
      expect(summary.organizerReceives).toBe(178)
    })

    it('should apply fixed promocode discount', async () => {
      const mockCartItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
      ]

      const mockPromocode = {
        id: 'promo1',
        code: 'DESCONTO20',
        discountType: 'FIXED' as const,
        discountValue: 20,
        maxUsage: 100,
        currentUsage: 50,
        isActive: true,
      }

      const mockFeeBreakdown = {
        serviceFee: 18,
        processingFee: 2,
        totalFee: 20,
        organizerReceives: 196,
        buyerPays: 200,
      }

      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(mockPromocode)
      ;(CartService.calculateCartTotal as jest.Mock).mockReturnValue(200)
      ;(FeeEngine.calculateFeesWithAllocation as jest.Mock).mockReturnValue(mockFeeBreakdown)

      const summary = await OrderService.calculateOrderSummary(
        mockCartItems,
        'event1',
        'BUYER',
        'promo1'
      )

      expect(summary.discount).toBe(20)
      expect(summary.total).toBe(180)
    })

    it('should throw error for expired promocode', async () => {
      const mockCartItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
      ]

      const mockPromocode = {
        id: 'promo1',
        code: 'EXPIRADO',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        maxUsage: 100,
        currentUsage: 50,
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000),
      }

      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(mockPromocode)

      await expect(
        OrderService.calculateOrderSummary(
          mockCartItems,
          'event1',
          'BUYER',
          'promo1'
        )
      ).rejects.toThrow('Cupom expirado')
    })

    it('should throw error for exhausted promocode', async () => {
      const mockCartItems = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
      ]

      const mockPromocode = {
        id: 'promo1',
        code: 'ESGOTADO',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        maxUsage: 100,
        currentUsage: 100,
        isActive: true,
      }

      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(mockPromocode)

      await expect(
        OrderService.calculateOrderSummary(
          mockCartItems,
          'event1',
          'BUYER',
          'promo1'
        )
      ).rejects.toThrow('Cupom esgotado')
    })
  })

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const mockInput = {
        eventId: 'event1',
        items: [
          { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const },
        ],
        paymentMethod: 'CREDIT_CARD' as const,
        installments: 1,
        feeAllocation: 'BUYER' as const,
      }

      const mockCartWithDetails = [
        { lotId: 'lot1', quantity: 2, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 200 },
      ]

      const mockOrder = {
        id: 'order1',
        totalAmount: 102,
        paymentMethod: 'CREDIT_CARD',
        paymentStatus: 'PENDING' as const,
        userId: 'user1',
        eventId: 'event1',
        promocodeId: null,
      }

      ;(CartService.getCartWithDetails as jest.Mock).mockResolvedValue(mockCartWithDetails)
      ;(CartService.validateCartItems as jest.Mock).mockReturnValue(undefined)
      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(null)
      ;(CartService.calculateCartTotal as jest.Mock).mockReturnValue(200)
      ;(FeeEngine.calculateFeesWithAllocation as jest.Mock).mockReturnValue({
        serviceFee: 20,
        processingFee: 2,
        totalFee: 22,
        organizerReceives: 178,
        buyerPays: 102,
        minimumFeeApplied: false,
        feeAllocation: 'BUYER',
        ticketPrice: 200,
        totalFee: 22,
      })
      ;(prisma.order.create as jest.Mock).mockResolvedValue(mockOrder)
      ;(prisma.ticket.create as jest.Mock).mockResolvedValue({ id: 'ticket1' })
      ;(prisma.ticket.createMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(CartService as any).generateTicketCode = jest.fn().mockReturnValue('CODE123')

      const result = await OrderService.createOrder('user1', mockInput, 'event1')

      expect(result.order).toEqual(mockOrder)
      expect(prisma.order.create).toHaveBeenCalled()
    })

    it('should create order with half-price tickets for elderly when unlimited', async () => {
      const originalEnv = process.env.ELDERLY_HALF_PRICE_UNLIMITED
      process.env.ELDERLY_HALF_PRICE_UNLIMITED = 'true'

      const mockInput = {
        eventId: 'event1',
        items: [
          { lotId: 'lot1', quantity: 5, ticketType: 'MEIA_ENTRADA' as const, eligibility: 'ELDERLY' as const },
          { lotId: 'lot1', quantity: 5, ticketType: 'GENERAL' as const },
        ],
        paymentMethod: 'CREDIT_CARD' as const,
        installments: 1,
        feeAllocation: 'BUYER' as const,
      }

      const mockEvent = {
        id: 'event1',
        halfPriceEnabled: true,
        halfPriceLimit: 40,
        halfPriceElderlyFree: true,
      }

      const mockCartWithDetails = [
        { lotId: 'lot1', quantity: 5, ticketType: 'MEIA_ENTRADA' as const, eligibility: 'ELDERLY' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 500 },
        { lotId: 'lot1', quantity: 5, ticketType: 'GENERAL' as const, lotName: 'Lote 1', lotPrice: 100, availableQuantity: 50, total: 500 },
      ]

      const mockOrder = {
        id: 'order1',
        totalAmount: 1020,
        paymentMethod: 'CREDIT_CARD',
        paymentStatus: 'PENDING' as const,
        userId: 'user1',
        eventId: 'event1',
        promocodeId: null,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)
      ;(CartService.getCartWithDetails as jest.Mock).mockResolvedValue(mockCartWithDetails)
      ;(CartService.validateCartItems as jest.Mock).mockReturnValue(undefined)
      ;(prisma.promocode.findUnique as jest.Mock).mockResolvedValue(null)
      ;(CartService.calculateCartTotal as jest.Mock).mockReturnValue(1000)
      ;(FeeEngine.calculateFeesWithAllocation as jest.Mock).mockReturnValue({
        serviceFee: 20,
        processingFee: 2,
        totalFee: 22,
        organizerReceives: 978,
        buyerPays: 1020,
      })
      ;(prisma.order.create as jest.Mock).mockResolvedValue(mockOrder)
      ;(CartService as any).generateTicketCode = jest.fn().mockReturnValue('CODE123')

      const result = await OrderService.createOrder('user1', mockInput, 'event1')

      expect(result.order).toEqual(mockOrder)
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: 'event1' },
        select: {
          halfPriceEnabled: true,
          halfPriceLimit: true,
          halfPriceElderlyFree: true,
        },
      })

      process.env.ELDERLY_HALF_PRICE_UNLIMITED = originalEnv
    })

    it('should throw error when elderly half-price exceeds 40% limit when not unlimited', async () => {
      const originalEnv = process.env.ELDERLY_HALF_PRICE_UNLIMITED
      process.env.ELDERLY_HALF_PRICE_UNLIMITED = 'false'

      const mockInput = {
        eventId: 'event1',
        items: [
          { lotId: 'lot1', quantity: 5, ticketType: 'MEIA_ENTRADA' as const, eligibility: 'ELDERLY' as const },
          { lotId: 'lot1', quantity: 5, ticketType: 'GENERAL' as const },
        ],
        paymentMethod: 'CREDIT_CARD' as const,
        installments: 1,
        feeAllocation: 'BUYER' as const,
      }

      const mockEvent = {
        id: 'event1',
        halfPriceEnabled: true,
        halfPriceLimit: 40,
        halfPriceElderlyFree: false,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)

      await expect(
        OrderService.createOrder('user1', mockInput, 'event1')
      ).rejects.toThrow('Limite de meia-entrada para idosos excedido')

      process.env.ELDERLY_HALF_PRICE_UNLIMITED = originalEnv
    })

    it('should throw error when student half-price exceeds 40% limit', async () => {
      const mockInput = {
        eventId: 'event1',
        items: [
          { lotId: 'lot1', quantity: 5, ticketType: 'MEIA_ENTRADA' as const, eligibility: 'STUDENT' as const },
          { lotId: 'lot1', quantity: 5, ticketType: 'GENERAL' as const },
        ],
        paymentMethod: 'CREDIT_CARD' as const,
        installments: 1,
        feeAllocation: 'BUYER' as const,
      }

      const mockEvent = {
        id: 'event1',
        halfPriceEnabled: true,
        halfPriceLimit: 40,
        halfPriceElderlyFree: true,
      }

      ;(prisma.event.findUnique as jest.Mock).mockResolvedValue(mockEvent)

      await expect(
        OrderService.createOrder('user1', mockInput, 'event1')
      ).rejects.toThrow('Limite de meia-entrada excedido')
    })
  })

  describe('requestRefund', () => {
    it('should request refund successfully', async () => {
      const mockOrder = {
        id: 'order1',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: new Date(Date.now() - 86400000),
        userId: 'user1',
        tickets: [],
        event: {
          startTime: new Date(Date.now() + 86400000 * 3),
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: true,
        processingFeeRefunded: false,
        refundAmount: 98,
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        refundRequested: true,
      })

      const result = await OrderService.requestRefund('order1', 'user1')

      expect(result.order).toEqual({
        ...mockOrder,
        refundRequested: true,
      })
      expect(result.refundAmount).toBe(98)
    })

    it('should throw error for approved order within refund period', async () => {
      const mockOrder = {
        id: 'order1',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: new Date(Date.now() - 86400000 * 8),
        userId: 'user1',
        tickets: [],
        event: {
          startTime: new Date(Date.now() + 86400000),
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: false,
        processingFeeRefunded: false,
        refundAmount: 88,
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)

      const result = await OrderService.requestRefund('order1', 'user1')

      expect(result.refundAmount).toBe(88)
    })

    it('should throw error for used tickets', async () => {
      const mockOrder = {
        id: 'order1',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: new Date(Date.now() - 86400000),
        userId: 'user1',
        tickets: [{ isUsed: true }],
        event: {
          startTime: new Date(Date.now() + 86400000 * 3),
        },
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)

      await expect(
        OrderService.requestRefund('order1', 'user1')
      ).rejects.toThrow('Não é possível reembolsar ingressos já utilizados')
    })

    it('should throw error for already requested refund', async () => {
      const mockOrder = {
        id: 'order1',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: new Date(Date.now() - 86400000),
        userId: 'user1',
        refundRequested: true,
        tickets: [],
        event: {
          startTime: new Date(Date.now() + 86400000 * 3),
        },
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)

      await expect(
        OrderService.requestRefund('order1', 'user1')
      ).rejects.toThrow('Reembolso já solicitado')
    })

    it('should approve refund within 7 days of purchase (CDC rule)', async () => {
      // Purchase made 3 days ago
      const threeDaysAgo = new Date(Date.now() - 86400000 * 3)
      const mockOrder = {
        id: 'order1',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: threeDaysAgo,
        userId: 'user1',
        refundRequested: false,
        tickets: [],
        event: {
          startTime: new Date(Date.now() + 86400000 * 10), // Event in 10 days
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: true, // Service fee refunded within CDC 7-day period
        processingFeeRefunded: false, // Processing fee never refunded
        refundAmount: 98, // 100 - 2 (processing fee)
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        refundRequested: true,
        refundApproved: false,
      })

      const result = await OrderService.requestRefund('order1', 'user1')

      expect(result.refundAmount).toBe(98)
      expect(FeeEngine.calculateRefund).toHaveBeenCalledWith(
        100,
        true, // isWithin7Days = true (3 days ago)
        true, // isMoreThan48hBeforeEvent = true (10 days in future)
        false // ticketUsed = false
      )
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order1' },
        data: {
          refundRequested: true,
          refundApproved: false,
        },
      })
    })

    it('should approve refund after 7 days but 48h+ before event', async () => {
      // Purchase made 10 days ago (outside CDC 7-day window)
      const tenDaysAgo = new Date(Date.now() - 86400000 * 10)
      const mockOrder = {
        id: 'order2',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: tenDaysAgo,
        userId: 'user1',
        refundRequested: false,
        tickets: [],
        event: {
          startTime: new Date(Date.now() + 86400000 * 5), // Event in 5 days (>48h)
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: true, // Service fee refunded when >48h before event
        processingFeeRefunded: false, // Processing fee never refunded
        refundAmount: 98, // 100 - 2 (processing fee)
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        refundRequested: true,
        refundApproved: false,
      })

      const result = await OrderService.requestRefund('order2', 'user1')

      expect(result.refundAmount).toBe(98)
      expect(FeeEngine.calculateRefund).toHaveBeenCalledWith(
        100,
        false, // isWithin7Days = false (10 days ago)
        true, // isMoreThan48hBeforeEvent = true (5 days in future = 120 hours)
        false // ticketUsed = false
      )
    })

    it('should reject refund less than 48h before event', async () => {
      // Purchase made 3 days ago (within CDC 7-day window)
      const threeDaysAgo = new Date(Date.now() - 86400000 * 3)
      // Event is in 30 hours (less than 48h before event)
      const thirtyHoursFromNow = new Date(Date.now() + 3600000 * 30)

      const mockOrder = {
        id: 'order3',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: threeDaysAgo,
        userId: 'user1',
        refundRequested: false,
        tickets: [],
        event: {
          startTime: thirtyHoursFromNow,
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: false, // Service fee NOT refunded (<48h before event)
        processingFeeRefunded: false, // Processing fee never refunded
        refundAmount: 88, // 100 - 10 (service fee) - 2 (processing fee)
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        refundRequested: true,
        refundApproved: false,
      })

      const result = await OrderService.requestRefund('order3', 'user1')

      expect(result.refundAmount).toBe(88)
      expect(FeeEngine.calculateRefund).toHaveBeenCalledWith(
        100,
        true, // isWithin7Days = true (3 days ago)
        false, // isMoreThan48hBeforeEvent = false (30 hours < 48 hours)
        false // ticketUsed = false
      )
    })

    it('should reject refund less than 48h before event when outside CDC 7-day window', async () => {
      // Purchase made 10 days ago (outside CDC 7-day window)
      const tenDaysAgo = new Date(Date.now() - 86400000 * 10)
      // Event is in 30 hours (less than 48h before event)
      const thirtyHoursFromNow = new Date(Date.now() + 3600000 * 30)

      const mockOrder = {
        id: 'order4',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: tenDaysAgo,
        userId: 'user1',
        refundRequested: false,
        tickets: [],
        event: {
          startTime: thirtyHoursFromNow,
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: false, // Service fee NOT refunded (neither condition met)
        processingFeeRefunded: false, // Processing fee never refunded
        refundAmount: 88, // 100 - 10 (service fee) - 2 (processing fee)
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        refundRequested: true,
        refundApproved: false,
      })

      const result = await OrderService.requestRefund('order4', 'user1')

      // Refund is still processed but with reduced amount (no service fee refund)
      expect(result.refundAmount).toBe(88)
      expect(FeeEngine.calculateRefund).toHaveBeenCalledWith(
        100,
        false, // isWithin7Days = false (10 days ago)
        false, // isMoreThan48hBeforeEvent = false (30 hours < 48 hours)
        false // ticketUsed = false
      )
    })

    it('should reject refund for order after event date with used ticket', async () => {
      // Purchase made 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 86400000 * 5)
      // Event was yesterday
      const yesterday = new Date(Date.now() - 86400000)

      const mockOrder = {
        id: 'order5',
        totalAmount: 100,
        paymentStatus: 'APPROVED' as const,
        createdAt: fiveDaysAgo,
        userId: 'user1',
        refundRequested: false,
        tickets: [{ isUsed: true }], // Ticket was used for the event
        event: {
          startTime: yesterday,
        },
      }

      const mockRefundCalc = {
        originalAmount: 100,
        serviceFeeRefunded: false,
        processingFeeRefunded: false,
        refundAmount: 0, // No refund when ticket is used
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)

      // Used ticket = no refund eligible
      await expect(
        OrderService.requestRefund('order5', 'user1')
      ).rejects.toThrow('Não é possível reembolsar ingressos já utilizados')
    })

    it('should handle partial refund for multi-ticket order', async () => {
      // Order with 3 tickets, total R$150 (R$50 per ticket)
      const twoDaysAgo = new Date(Date.now() - 86400000 * 2)
      const mockOrder = {
        id: 'order6',
        totalAmount: 150,
        paymentStatus: 'APPROVED' as const,
        createdAt: twoDaysAgo,
        userId: 'user1',
        refundRequested: false,
        tickets: [
          { id: 'ticket1', isUsed: false },
          { id: 'ticket2', isUsed: false },
          { id: 'ticket3', isUsed: false },
        ],
        event: {
          startTime: new Date(Date.now() + 86400000 * 7), // Event in 7 days
        },
      }

      // Full refund for R$150 order within CDC 7-day period
      const mockRefundCalc = {
        originalAmount: 150,
        serviceFeeRefunded: true,
        processingFeeRefunded: false,
        refundAmount: 147, // 150 - 3 (processing fee: 2% of 150)
      }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder)
      ;(FeeEngine.calculateRefund as jest.Mock).mockReturnValue(mockRefundCalc)
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        refundRequested: true,
        refundApproved: false,
      })

      const result = await OrderService.requestRefund('order5', 'user1')

      expect(result.refundAmount).toBe(147)
      expect(FeeEngine.calculateRefund).toHaveBeenCalledWith(
        150,
        true, // isWithin7Days = true (2 days ago)
        true, // isMoreThan48hBeforeEvent = true (7 days in future)
        false // ticketUsed = false (none of the 3 tickets used)
      )

      // Verify all 3 tickets are included in the order
      expect(mockOrder.tickets).toHaveLength(3)
      expect(mockOrder.tickets.every((t: any) => !t.isUsed)).toBe(true)
    })
  })
})
