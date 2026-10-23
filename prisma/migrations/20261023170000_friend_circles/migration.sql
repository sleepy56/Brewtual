-- CreateTable
CREATE TABLE "Circle" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMember" (
    "circleId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "CircleMember_pkey" PRIMARY KEY ("circleId","userId")
);

-- CreateTable
CREATE TABLE "CircleGoal" (
    "id" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CircleGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleCheer" (
    "goalId" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "CircleCheer_pkey" PRIMARY KEY ("goalId","userId")
);

-- CreateTable
CREATE TABLE "CircleOffer" (
    "id" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "CircleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CirclePledge" (
    "offerId" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "CirclePledge_pkey" PRIMARY KEY ("offerId","userId")
);

-- CreateTable
CREATE TABLE "ConnectionCode" (
    "hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ConnectionCode_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "CircleGoal_id_circleId_key" ON "CircleGoal"("id", "circleId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleOffer_id_circleId_key" ON "CircleOffer"("id", "circleId");

-- CreateIndex
CREATE INDEX "ConnectionCode_targetId_idx" ON "ConnectionCode"("targetId");

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleGoal" ADD CONSTRAINT "CircleGoal_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleGoal" ADD CONSTRAINT "CircleGoal_circleId_ownerId_fkey" FOREIGN KEY ("circleId", "ownerId") REFERENCES "CircleMember"("circleId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleCheer" ADD CONSTRAINT "CircleCheer_goalId_circleId_fkey" FOREIGN KEY ("goalId", "circleId") REFERENCES "CircleGoal"("id", "circleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleCheer" ADD CONSTRAINT "CircleCheer_circleId_userId_fkey" FOREIGN KEY ("circleId", "userId") REFERENCES "CircleMember"("circleId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleOffer" ADD CONSTRAINT "CircleOffer_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleOffer" ADD CONSTRAINT "CircleOffer_circleId_authorId_fkey" FOREIGN KEY ("circleId", "authorId") REFERENCES "CircleMember"("circleId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleOffer" ADD CONSTRAINT "CircleOffer_goalId_circleId_fkey" FOREIGN KEY ("goalId", "circleId") REFERENCES "CircleGoal"("id", "circleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePledge" ADD CONSTRAINT "CirclePledge_offerId_circleId_fkey" FOREIGN KEY ("offerId", "circleId") REFERENCES "CircleOffer"("id", "circleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePledge" ADD CONSTRAINT "CirclePledge_circleId_userId_fkey" FOREIGN KEY ("circleId", "userId") REFERENCES "CircleMember"("circleId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
