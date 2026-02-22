-- Create AuditAction enum type
CREATE TYPE "AuditAction" AS ENUM (
    'USER_LOGIN',
    'USER_LOGOUT',
    'USER_REGISTER',
    'PAYMENT_PROCESSED',
    'PAYMENT_FAILED',
    'PAYMENT_REFUNDED',
    'REFUND_APPROVED',
    'REFUND_REJECTED',
    'PAYOUT_PROCESSED',
    'PAYOUT_FAILED',
    'ORDER_CREATED',
    'ORDER_CANCELLED',
    'TICKET_CHECKED_IN',
    'EVENT_CREATED',
    'EVENT_UPDATED',
    'EVENT_DELETED',
    'PROMOCODE_CREATED',
    'PROMOCODE_USED',
    'TEAM_MEMBER_ADDED',
    'TEAM_MEMBER_REMOVED',
    'BANK_ACCOUNT_ADDED',
    'BANK_ACCOUNT_REMOVED',
    'API_KEY_CREATED',
    'API_KEY_REVOKED',
    'WEBHOOK_RECEIVED'
);

-- Create AuditLog table
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Create indexes for AuditLog
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
