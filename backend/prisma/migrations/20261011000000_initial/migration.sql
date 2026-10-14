CREATE TYPE "GoalStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "RewardStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
CREATE TYPE "RedemptionStatus" AS ENUM ('REQUESTED', 'FULFILLED');
CREATE TYPE "LedgerReason" AS ENUM ('WEEKLY_AWARD', 'REWARD_REDEMPTION');

CREATE FUNCTION "int_array_has_unique_values"(values_array INTEGER[])
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT cardinality(values_array) = count(DISTINCT value)::INTEGER
  FROM unnest(values_array) AS value
$$;

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pair" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" UUID NOT NULL,
  "pairId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "slot" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Membership_slot_check" CHECK ("slot" IN (1, 2))
);

CREATE TABLE "Invite" (
  "id" UUID NOT NULL,
  "pairId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "acceptedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Goal" (
  "id" UUID NOT NULL,
  "pairId" UUID NOT NULL,
  "ownerId" UUID NOT NULL,
  "proposedById" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "weekdays" INTEGER[] NOT NULL,
  "requiredCount" INTEGER NOT NULL,
  "weeklyTokens" INTEGER NOT NULL,
  "status" "GoalStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" UUID,
  "approvedAt" TIMESTAMPTZ(6),
  "startsOn" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Goal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Goal_weekdays_check" CHECK (
    cardinality("weekdays") BETWEEN 1 AND 7
    AND "weekdays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[]
    AND "int_array_has_unique_values"("weekdays")
  ),
  CONSTRAINT "Goal_target_check" CHECK (
    "requiredCount" > 0
    AND "requiredCount" <= cardinality("weekdays")
    AND "weeklyTokens" > 0
  ),
  CONSTRAINT "Goal_approval_state_check" CHECK (
    ("status" = 'ACTIVE' AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR ("status" <> 'ACTIVE' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
  ),
  CONSTRAINT "Goal_startsOn_check" CHECK (
    "startsOn" IS NULL OR (
      "startsOn" ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date("startsOn", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "startsOn"
    )
  )
);

CREATE TABLE "CheckIn" (
  "id" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "localDate" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckIn_localDate_check" CHECK (
    "localDate" ~ '^\d{4}-\d{2}-\d{2}$'
    AND to_char(to_date("localDate", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "localDate"
  )
);

CREATE TABLE "WeeklySettlement" (
  "id" UUID NOT NULL,
  "goalId" UUID NOT NULL,
  "weekStart" TEXT NOT NULL,
  "completedCount" INTEGER NOT NULL,
  "requiredCount" INTEGER NOT NULL,
  "awardedTokens" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklySettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklySettlement_counts_check" CHECK (
    "completedCount" >= 0 AND "requiredCount" > 0 AND "awardedTokens" >= 0
  ),
  CONSTRAINT "WeeklySettlement_weekStart_check" CHECK (
    "weekStart" ~ '^\d{4}-\d{2}-\d{2}$'
    AND to_char(to_date("weekStart", 'YYYY-MM-DD'), 'YYYY-MM-DD') = "weekStart"
  )
);

CREATE TABLE "Reward" (
  "id" UUID NOT NULL,
  "pairId" UUID NOT NULL,
  "offeredById" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fulfillmentExpectation" TEXT NOT NULL,
  "cost" INTEGER NOT NULL,
  "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
  "approvedById" UUID,
  "approvedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reward_cost_check" CHECK ("cost" > 0),
  CONSTRAINT "Reward_approval_state_check" CHECK (
    ("status" = 'ACTIVE' AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR ("status" <> 'ACTIVE' AND "approvedById" IS NULL AND "approvedAt" IS NULL)
  )
);

CREATE TABLE "Redemption" (
  "id" UUID NOT NULL,
  "pairId" UUID NOT NULL,
  "rewardId" UUID NOT NULL,
  "spenderId" UUID NOT NULL,
  "cost" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt" TIMESTAMPTZ(6),
  CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Redemption_cost_check" CHECK ("cost" > 0),
  CONSTRAINT "Redemption_fulfilled_check" CHECK (
    ("status" = 'FULFILLED' AND "fulfilledAt" IS NOT NULL)
    OR ("status" = 'REQUESTED' AND "fulfilledAt" IS NULL)
  )
);

CREATE TABLE "LedgerEntry" (
  "id" UUID NOT NULL,
  "pairId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" "LedgerReason" NOT NULL,
  "sourceId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerEntry_amount_check" CHECK (
    ("reason" = 'WEEKLY_AWARD' AND "amount" > 0)
    OR ("reason" = 'REWARD_REDEMPTION' AND "amount" < 0)
  )
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_pairId_slot_key" ON "Membership"("pairId", "slot");
CREATE UNIQUE INDEX "Membership_pairId_userId_key" ON "Membership"("pairId", "userId");
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
CREATE UNIQUE INDEX "Goal_id_ownerId_key" ON "Goal"("id", "ownerId");
CREATE UNIQUE INDEX "CheckIn_goalId_localDate_key" ON "CheckIn"("goalId", "localDate");
CREATE UNIQUE INDEX "WeeklySettlement_goalId_weekStart_key" ON "WeeklySettlement"("goalId", "weekStart");
CREATE UNIQUE INDEX "Reward_id_pairId_key" ON "Reward"("id", "pairId");
CREATE UNIQUE INDEX "Redemption_spenderId_idempotencyKey_key" ON "Redemption"("spenderId", "idempotencyKey");
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_pairId_createdById_fkey"
  FOREIGN KEY ("pairId", "createdById") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_pairId_ownerId_fkey"
  FOREIGN KEY ("pairId", "ownerId") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_pairId_proposedById_fkey"
  FOREIGN KEY ("pairId", "proposedById") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_pairId_approvedById_fkey"
  FOREIGN KEY ("pairId", "approvedById") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_goalId_userId_fkey"
  FOREIGN KEY ("goalId", "userId") REFERENCES "Goal"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklySettlement" ADD CONSTRAINT "WeeklySettlement_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_pairId_offeredById_fkey"
  FOREIGN KEY ("pairId", "offeredById") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_pairId_approvedById_fkey"
  FOREIGN KEY ("pairId", "approvedById") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_pairId_fkey"
  FOREIGN KEY ("rewardId", "pairId") REFERENCES "Reward"("id", "pairId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_pairId_spenderId_fkey"
  FOREIGN KEY ("pairId", "spenderId") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_pairId_fkey"
  FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_pairId_userId_fkey"
  FOREIGN KEY ("pairId", "userId") REFERENCES "Membership"("pairId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_ledger_entry_mutation"()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry rows are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "LedgerEntry_append_only"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "reject_ledger_entry_mutation"();
