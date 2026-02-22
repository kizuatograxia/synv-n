import { prisma } from '@/lib/db/prisma'
import { AuditAction } from '@prisma/client'
import { headers } from 'next/headers'

export interface AuditLogOptions {
  action: AuditAction
  entity: string
  entityId?: string
  userId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Audit Service for comprehensive logging of system actions
 *
 * This service provides centralized audit logging for all critical system events,
 * supporting compliance, security monitoring, and business intelligence.
 */
export class AuditService {
  /**
   * Log an audit action
   *
   * Automatically captures IP address and user agent from request context when available.
   *
   * @param options - Audit log options
   * @returns The created audit log entry
   */
  static async logAction(options: AuditLogOptions) {
    // Try to get IP and user agent from request context if not provided
    let ipAddress = options.ipAddress
    let userAgent = options.userAgent

    if (!ipAddress || !userAgent) {
      try {
        const headersList = await headers()
        ipAddress = ipAddress || headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined
        userAgent = userAgent || headersList.get('user-agent') || undefined
      } catch {
        // Headers might not be available in all contexts (e.g., background jobs)
        // This is expected, so we silently continue
      }
    }

    return await prisma.auditLog.create({
      data: {
        action: options.action,
        entity: options.entity,
        entityId: options.entityId,
        userId: options.userId,
        details: options.details,
        ipAddress,
        userAgent
      }
    })
  }

  /**
   * Log user login event
   */
  static async logUserLogin(userId: string, details?: { success: boolean; method?: string }) {
    return this.logAction({
      action: AuditAction.USER_LOGIN,
      entity: 'User',
      entityId: userId,
      userId,
      details
    })
  }

  /**
   * Log user logout event
   */
  static async logUserLogout(userId: string) {
    return this.logAction({
      action: AuditAction.USER_LOGOUT,
      entity: 'User',
      entityId: userId,
      userId
    })
  }

  /**
   * Log user registration event
   */
  static async logUserRegistration(userId: string, details?: { name?: string; email?: string }) {
    return this.logAction({
      action: AuditAction.USER_REGISTER,
      entity: 'User',
      entityId: userId,
      userId,
      details
    })
  }

  /**
   * Log payment processing event
   */
  static async logPayment(orderId: string, userId: string, details: {
    success: boolean
    amount: number
    paymentMethod?: string
    transactionId?: string
    failureReason?: string
  }) {
    return this.logAction({
      action: details.success ? AuditAction.PAYMENT_PROCESSED : AuditAction.PAYMENT_FAILED,
      entity: 'Order',
      entityId: orderId,
      userId,
      details
    })
  }

  /**
   * Log refund event
   */
  static async logRefund(orderId: string, userId: string, details: {
    approved: boolean
    amount: number
    reason?: string
    rejectedReason?: string
  }) {
    return this.logAction({
      action: details.approved ? AuditAction.REFUND_APPROVED : AuditAction.REFUND_REJECTED,
      entity: 'Order',
      entityId: orderId,
      userId,
      details
    })
  }

  /**
   * Log payout processing event
   */
  static async logPayout(payoutId: string, userId: string, details: {
    success: boolean
    amount: number
    method?: string
    failureReason?: string
  }) {
    return this.logAction({
      action: details.success ? AuditAction.PAYOUT_PROCESSED : AuditAction.PAYOUT_FAILED,
      entity: 'Payout',
      entityId: payoutId,
      userId,
      details
    })
  }

  /**
   * Log order creation
   */
  static async logOrderCreated(orderId: string, userId: string, details?: {
    totalAmount: number
    ticketCount: number
    eventId: string
  }) {
    return this.logAction({
      action: AuditAction.ORDER_CREATED,
      entity: 'Order',
      entityId: orderId,
      userId,
      details
    })
  }

  /**
   * Log order cancellation
   */
  static async logOrderCancelled(orderId: string, userId: string, details?: {
    reason?: string
    refundAmount?: number
  }) {
    return this.logAction({
      action: AuditAction.ORDER_CANCELLED,
      entity: 'Order',
      entityId: orderId,
      userId,
      details
    })
  }

  /**
   * Log ticket check-in
   */
  static async logTicketCheckIn(ticketId: string, userId: string, details?: {
    eventId: string
    checkedBy: string
  }) {
    return this.logAction({
      action: AuditAction.TICKET_CHECKED_IN,
      entity: 'Ticket',
      entityId: ticketId,
      userId,
      details
    })
  }

  /**
   * Log event CRUD operations
   */
  static async logEventCreated(eventId: string, userId: string, details?: {
    title: string
    expectedAttendees?: number
  }) {
    return this.logAction({
      action: AuditAction.EVENT_CREATED,
      entity: 'Event',
      entityId: eventId,
      userId,
      details
    })
  }

  static async logEventUpdated(eventId: string, userId: string, details?: {
    changes: Record<string, { from: any; to: any }>
  }) {
    return this.logAction({
      action: AuditAction.EVENT_UPDATED,
      entity: 'Event',
      entityId: eventId,
      userId,
      details
    })
  }

  static async logEventDeleted(eventId: string, userId: string, details?: {
    title: string
    reason?: string
  }) {
    return this.logAction({
      action: AuditAction.EVENT_DELETED,
      entity: 'Event',
      entityId: eventId,
      userId,
      details
    })
  }

  /**
   * Log promo code operations
   */
  static async logPromoCodeCreated(promoCodeId: string, userId: string, details?: {
    code: string
    discountType: string
    discountValue: number
  }) {
    return this.logAction({
      action: AuditAction.PROMOCODE_CREATED,
      entity: 'PromoCode',
      entityId: promoCodeId,
      userId,
      details
    })
  }

  static async logPromoCodeUsed(promoCodeId: string, userId: string, details?: {
    orderId: string
    discountAmount: number
  }) {
    return this.logAction({
      action: AuditAction.PROMOCODE_USED,
      entity: 'PromoCode',
      entityId: promoCodeId,
      userId,
      details
    })
  }

  /**
   * Log team member operations
   */
  static async logTeamMemberAdded(eventId: string, userId: string, details: {
    memberId: string
    memberName: string
    role: string
  }) {
    return this.logAction({
      action: AuditAction.TEAM_MEMBER_ADDED,
      entity: 'Event',
      entityId: eventId,
      userId,
      details
    })
  }

  static async logTeamMemberRemoved(eventId: string, userId: string, details: {
    memberId: string
    memberName: string
    reason?: string
  }) {
    return this.logAction({
      action: AuditAction.TEAM_MEMBER_REMOVED,
      entity: 'Event',
      entityId: eventId,
      userId,
      details
    })
  }

  /**
   * Log bank account operations
   */
  static async logBankAccountAdded(userId: string, details?: {
    accountLast4: string
    bankName?: string
    isPrimary: boolean
  }) {
    return this.logAction({
      action: AuditAction.BANK_ACCOUNT_ADDED,
      entity: 'BankAccount',
      userId,
      details
    })
  }

  static async logBankAccountRemoved(userId: string, details?: {
    accountLast4: string
    reason?: string
  }) {
    return this.logAction({
      action: AuditAction.BANK_ACCOUNT_REMOVED,
      entity: 'BankAccount',
      userId,
      details
    })
  }

  /**
   * Log API key operations
   */
  static async logApiKeyCreated(userId: string, details?: {
    keyName: string
    scopes: string[]
  }) {
    return this.logAction({
      action: AuditAction.API_KEY_CREATED,
      entity: 'ApiKey',
      userId,
      details
    })
  }

  static async logApiKeyRevoked(userId: string, details?: {
    keyId: string
    keyName: string
    reason?: string
  }) {
    return this.logAction({
      action: AuditAction.API_KEY_REVOKED,
      entity: 'ApiKey',
      userId,
      details
    })
  }

  /**
   * Log webhook received
   */
  static async logWebhookReceived(details: {
    source: string
    eventType: string
    eventId?: string
    payloadSize?: number
  }) {
    return this.logAction({
      action: AuditAction.WEBHOOK_RECEIVED,
      entity: 'Webhook',
      details
    })
  }

  /**
   * Query audit logs with filters
   */
  static async queryLogs(params: {
    userId?: string
    action?: AuditAction
    entity?: string
    entityId?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }) {
    const where: any = {}

    if (params.userId) where.userId = params.userId
    if (params.action) where.action = params.action
    if (params.entity) where.entity = params.entity
    if (params.entityId) where.entityId = params.entityId
    if (params.startDate || params.endDate) {
      where.createdAt = {}
      if (params.startDate) where.createdAt.gte = params.startDate
      if (params.endDate) where.createdAt.lte = params.endDate
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 100,
        skip: params.offset || 0
      }),
      prisma.auditLog.count({ where })
    ])

    return { logs, total }
  }

  /**
   * Get audit logs for a specific entity
   */
  static async getEntityHistory(entity: string, entityId: string, limit = 50) {
    return this.queryLogs({ entity, entityId, limit })
  }

  /**
   * Get audit logs for a specific user
   */
  static async getUserActivity(userId: string, limit = 100) {
    return this.queryLogs({ userId, limit })
  }
}

export const auditService = AuditService
