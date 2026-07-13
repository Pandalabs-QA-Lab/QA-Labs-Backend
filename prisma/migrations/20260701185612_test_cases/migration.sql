-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKER', 'SKIPPED', 'REPORTED', 'NEED_CLARIFICATION', 'TESTING_IN_PROGRESS', 'HOLD');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MED', 'LOW');

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceTcId" TEXT,
    "title" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT '',
    "scenario" TEXT NOT NULL DEFAULT '',
    "preconditions" TEXT NOT NULL DEFAULT '',
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "testData" TEXT NOT NULL DEFAULT '',
    "expected" TEXT NOT NULL DEFAULT '',
    "actual" TEXT NOT NULL DEFAULT '',
    "status" "TestCaseStatus" NOT NULL DEFAULT 'NOT_EXECUTED',
    "priority" "Priority" NOT NULL DEFAULT 'MED',
    "assignee" TEXT NOT NULL DEFAULT '',
    "devRemarks" TEXT NOT NULL DEFAULT '',
    "qaRemarks" TEXT NOT NULL DEFAULT '',
    "evidenceLinks" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "history" JSONB NOT NULL DEFAULT '[]',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "updatedBy" TEXT,
    "updatedByName" TEXT,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCase_projectId_idx" ON "TestCase"("projectId");

-- CreateIndex
CREATE INDEX "TestCase_projectId_module_idx" ON "TestCase"("projectId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_projectId_sourceTcId_key" ON "TestCase"("projectId", "sourceTcId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
