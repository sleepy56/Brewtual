CREATE TABLE "TaskShare" (
  "taskId" UUID NOT NULL REFERENCES "PersonalTask"("id") ON DELETE CASCADE,
  "scopeKind" "TaskSpaceKind" NOT NULL,
  "scopeId" UUID NOT NULL,
  PRIMARY KEY ("taskId", "scopeKind", "scopeId")
);
CREATE INDEX "TaskShare_scopeKind_scopeId_idx" ON "TaskShare"("scopeKind", "scopeId");

-- Token requests already share these task details with their space.
INSERT INTO "TaskShare" ("taskId", "scopeKind", "scopeId")
SELECT "taskId", "scopeKind", "scopeId" FROM "TaskTokenProposal";
