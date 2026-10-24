-- CreateEnum
CREATE TYPE "PersonalTaskKind" AS ENUM ('TODO', 'DAILY', 'GOAL');

-- CreateEnum
CREATE TYPE "TaskSpaceKind" AS ENUM ('PAIR', 'GROUP');

-- AlterEnum
ALTER TYPE "LedgerReason" ADD VALUE 'TASK_AWARD';

-- Existing partner wallets also receive personal-task awards.
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_amount_check";
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_amount_check" CHECK (
    ("reason"::text IN ('WEEKLY_AWARD', 'TASK_AWARD') AND "amount" > 0)
    OR ("reason"::text = 'REWARD_REDEMPTION' AND "amount" < 0)
);

-- CreateTable
CREATE TABLE "PersonalTask" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "kind" "PersonalTaskKind" NOT NULL,
    "timezone" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "dueOn" TEXT,
    "target" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTokenProposal" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "scopeKind" "TaskSpaceKind" NOT NULL,
    "scopeId" UUID NOT NULL,
    "tokens" INTEGER NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTokenProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAward" (
    "id" UUID NOT NULL,
    "completionId" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleTokenEntry" (
    "id" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "LedgerReason" NOT NULL,
    "sourceId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleTokenEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CircleTokenEntry_amount_check" CHECK (
        ("reason"::text = 'TASK_AWARD' AND "amount" > 0)
        OR ("reason"::text = 'REWARD_REDEMPTION' AND "amount" < 0)
    )
);

-- CreateTable
CREATE TABLE "SpaceReward" (
    "id" UUID NOT NULL,
    "scopeKind" "TaskSpaceKind" NOT NULL,
    "scopeId" UUID NOT NULL,
    "offeredById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "expectation" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceRedemption" (
    "id" UUID NOT NULL,
    "rewardId" UUID NOT NULL,
    "spenderId" UUID NOT NULL,
    "cost" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMPTZ(6),

    CONSTRAINT "SpaceRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalTask_userId_archived_idx" ON "PersonalTask"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_taskId_period_key" ON "TaskCompletion"("taskId", "period");

-- CreateIndex
CREATE INDEX "TaskTokenProposal_scopeKind_scopeId_idx" ON "TaskTokenProposal"("scopeKind", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTokenProposal_taskId_scopeKind_scopeId_key" ON "TaskTokenProposal"("taskId", "scopeKind", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAward_completionId_proposalId_key" ON "TaskAward"("completionId", "proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleTokenEntry_idempotencyKey_key" ON "CircleTokenEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CircleTokenEntry_circleId_userId_idx" ON "CircleTokenEntry"("circleId", "userId");

-- CreateIndex
CREATE INDEX "SpaceReward_scopeKind_scopeId_idx" ON "SpaceReward"("scopeKind", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceRedemption_spenderId_idempotencyKey_key" ON "SpaceRedemption"("spenderId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PersonalTask" ADD CONSTRAINT "PersonalTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCompletion" ADD CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PersonalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTokenProposal" ADD CONSTRAINT "TaskTokenProposal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PersonalTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAward" ADD CONSTRAINT "TaskAward_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "TaskCompletion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAward" ADD CONSTRAINT "TaskAward_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TaskTokenProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleTokenEntry" ADD CONSTRAINT "CircleTokenEntry_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleTokenEntry" ADD CONSTRAINT "CircleTokenEntry_circleId_userId_fkey" FOREIGN KEY ("circleId", "userId") REFERENCES "CircleMember"("circleId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceReward" ADD CONSTRAINT "SpaceReward_offeredById_fkey" FOREIGN KEY ("offeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceRedemption" ADD CONSTRAINT "SpaceRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "SpaceReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceRedemption" ADD CONSTRAINT "SpaceRedemption_spenderId_fkey" FOREIGN KEY ("spenderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "CircleTokenEntry_append_only"
    BEFORE UPDATE OR DELETE ON "CircleTokenEntry"
    FOR EACH ROW EXECUTE FUNCTION "reject_ledger_entry_mutation"();
