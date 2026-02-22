import { FeeEngine, PayoutCalculation } from '../fees'
import { prisma } from '../db/prisma'
import { auditService } from './audit-service'
import { addBusinessDays } from '../utils/business-days'

export interface CreatePayoutInput {
  bankAccountId?: string
  anticipationAmount?: number
  eventId?: string
}

export interface PayoutRequest {
  id?: string
  totalSales: number
  totalFees: number
  netAmount: number
  anticipationAmount?: number
  anticipationFee?: number
  bankTransferFee?: number
  finalPayout: number
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'
  scheduledFor?: Date
  processedAt?: Date
  event?: {
    id: string
    title: string
  } | null
  createdAt?: Date
}

export class PayoutService {
  static async requestPayout(userId: string, input: CreatePayoutInput): Promise<PayoutRequest> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        eventsOrganized: true,
      },
    })

    if (!user) {
      throw new Error('Usuário não encontrado')
    }

    const totalSales = await prisma.order.aggregate({
      where: {
        userId,
        paymentStatus: 'APPROVED',
        ...(input.eventId ? { eventId: input.eventId } : {}),
      },
      _sum: {
        totalAmount: true,
      },
    })

    const salesAmount = totalSales._sum.totalAmount || 0

    if (salesAmount === 0) {
      throw new Error('Nenhuma venda aprovada encontrada')
    }

    const totalFees = await this.calculateTotalFees(salesAmount)

    const bankAccount = input.bankAccountId
      ? await prisma.bankAccount.findUnique({
          where: { id: input.bankAccountId, userId },
        })
      : null

    if (input.bankAccountId && !bankAccount) {
      throw new Error('Conta bancária não encontrada')
    }

    const isSpecialBank = bankAccount ? FeeEngine.isSpecialBank(bankAccount.bankName) : false
    // R$7.50 fee charged per bank transfer (excluding special banks like NuBank, Inter, etc.)
    const bankTransferFee = bankAccount && !isSpecialBank ? 7.50 : undefined

    const payoutCalc: PayoutCalculation = FeeEngine.calculatePayout(
      salesAmount,
      totalFees,
      input.anticipationAmount,
      bankAccount?.bankName,
      isSpecialBank
    )

    // Schedule payout for 3 business days from now (excludes weekends and Brazilian holidays)
    const scheduledFor = addBusinessDays(new Date(), 3)

    const payout = await prisma.payout.create({
      data: {
        userId,
        totalSales: salesAmount,
        totalFees,
        netAmount: payoutCalc.netAmount,
        anticipationAmount: input.anticipationAmount,
        anticipationFee: payoutCalc.anticipationFee,
        bankTransferFee: payoutCalc.bankTransferFee,
        finalPayout: payoutCalc.finalPayout,
        status: 'PENDING',
        scheduledFor,
        bankAccountId: input.bankAccountId,
        eventId: input.eventId,
      },
    })

    // Log payout request for audit
    await auditService.logPayout(payout.id, userId, {
      success: true,
      amount: payoutCalc.finalPayout,
      method: bankAccount?.bankName || 'Default bank account',
    })

    return {
      totalSales: payout.totalSales,
      totalFees: payout.totalFees,
      netAmount: payout.netAmount,
      anticipationAmount: payout.anticipationAmount || undefined,
      anticipationFee: payout.anticipationFee || undefined,
      bankTransferFee: payout.bankTransferFee || undefined,
      finalPayout: payout.finalPayout,
      status: payout.status,
      scheduledFor: payout.scheduledFor || undefined,
    }
  }

  static async calculateTotalFees(salesAmount: number): Promise<number> {
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'APPROVED',
      },
      include: {
        tickets: true,
      },
    })

    let totalFees = 0

    for (const order of orders) {
      const feeBreakdown = FeeEngine.calculateFeesWithAllocation(
        order.totalAmount,
        'LIVE',
        'ORGANIZER'
      )
      totalFees += feeBreakdown.totalFee
    }

    return totalFees
  }

  static async getPayouts(userId: string, eventId?: string): Promise<PayoutRequest[]> {
    const where: any = { userId }
    if (eventId) {
      where.eventId = eventId
    }

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        bankAccount: {
          select: {
            bankName: true,
            account: true,
            accountHolder: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return payouts.map((payout) => ({
      id: payout.id,
      totalSales: payout.totalSales,
      totalFees: payout.totalFees,
      netAmount: payout.netAmount,
      anticipationAmount: payout.anticipationAmount || undefined,
      anticipationFee: payout.anticipationFee || undefined,
      bankTransferFee: payout.bankTransferFee || undefined,
      finalPayout: payout.finalPayout,
      status: payout.status,
      scheduledFor: payout.scheduledFor || undefined,
      processedAt: payout.processedAt || undefined,
      event: payout.event,
      createdAt: payout.createdAt,
    }))
  }

  static async approvePayout(payoutId: string, approverId: string): Promise<PayoutRequest> {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
    })

    if (!payout) {
      throw new Error('Solicitação não encontrada')
    }

    if (payout.status !== 'PENDING') {
      throw new Error('Solicitação não está pendente')
    }

    const approver = await prisma.user.findUnique({
      where: { id: approverId },
    })

    if (!approver || approver.role !== 'ADMIN') {
      throw new Error('Não autorizado')
    }

    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
      },
    })

    // Log payout approval for audit
    await auditService.logPayout(payoutId, approverId, {
      success: true,
      amount: updatedPayout.finalPayout,
      method: 'Admin approval',
    })

    return {
      totalSales: updatedPayout.totalSales,
      totalFees: updatedPayout.totalFees,
      netAmount: updatedPayout.netAmount,
      anticipationAmount: updatedPayout.anticipationAmount || undefined,
      anticipationFee: updatedPayout.anticipationFee || undefined,
      bankTransferFee: updatedPayout.bankTransferFee || undefined,
      finalPayout: updatedPayout.finalPayout,
      status: updatedPayout.status,
      scheduledFor: updatedPayout.scheduledFor || undefined,
    }
  }

  static async cancelPayout(payoutId: string, userId: string): Promise<PayoutRequest> {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
    })

    if (!payout) {
      throw new Error('Solicitação não encontrada')
    }

    if (payout.userId !== userId) {
      throw new Error('Não autorizado')
    }

    if (payout.status === 'PAID') {
      throw new Error('Solicitação já processada')
    }

    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'CANCELLED',
      },
    })

    return {
      totalSales: updatedPayout.totalSales,
      totalFees: updatedPayout.totalFees,
      netAmount: updatedPayout.netAmount,
      anticipationAmount: updatedPayout.anticipationAmount || undefined,
      anticipationFee: updatedPayout.anticipationFee || undefined,
      bankTransferFee: updatedPayout.bankTransferFee || undefined,
      finalPayout: updatedPayout.finalPayout,
      status: updatedPayout.status,
      scheduledFor: updatedPayout.scheduledFor || undefined,
    }
  }
}
