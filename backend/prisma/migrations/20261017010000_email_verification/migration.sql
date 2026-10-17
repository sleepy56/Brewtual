-- Accounts created before email verification remain usable with their existing passwords.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(6);
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "PendingSignup" (
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "lastSentAt" TIMESTAMPTZ(6) NOT NULL,
  "windowStart" TIMESTAMPTZ(6) NOT NULL,
  "sendCount" INTEGER NOT NULL,
  CONSTRAINT "PendingSignup_pkey" PRIMARY KEY ("email")
);
CREATE UNIQUE INDEX "PendingSignup_tokenHash_key" ON "PendingSignup"("tokenHash");
