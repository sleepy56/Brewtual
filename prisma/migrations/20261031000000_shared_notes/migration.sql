CREATE TABLE "SharedNote" (
  "id" UUID NOT NULL,
  "scopeKind" "TaskSpaceKind" NOT NULL,
  "scopeId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" UUID NOT NULL,
  "updatedById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SharedNote_version_check" CHECK ("version" > 0)
);
CREATE INDEX "SharedNote_scopeKind_scopeId_updatedAt_idx" ON "SharedNote"("scopeKind", "scopeId", "updatedAt");
