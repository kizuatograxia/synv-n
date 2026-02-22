-- Create Cart model
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "promocode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("userId")
);

-- Create unique index on userId
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- Create index on expiresAt
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");

-- Add foreign key to User
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
