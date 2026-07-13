-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "BugPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "RetestStatus" AS ENUM ('NOT_RETESTED', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "Bug" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceBugId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "module" TEXT NOT NULL DEFAULT '',
    "severity" "BugSeverity" NOT NULL DEFAULT 'MINOR',
    "priority" "BugPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "stepsToReproduce" TEXT NOT NULL DEFAULT '',
    "expected" TEXT NOT NULL DEFAULT '',
    "actual" TEXT NOT NULL DEFAULT '',
    "environment" TEXT NOT NULL DEFAULT '',
    "build" TEXT NOT NULL DEFAULT '',
    "fixedInBuild" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "reportedBy" TEXT,
    "reportedByName" TEXT,
    "reportedDate" TEXT,
    "retestStatus" "RetestStatus" NOT NULL DEFAULT 'NOT_RETESTED',
    "devRemarks" TEXT NOT NULL DEFAULT '',
    "qaRemarks" TEXT NOT NULL DEFAULT '',
    "linkedTestCaseId" TEXT,
    "evidenceLinks" JSONB NOT NULL DEFAULT '[]',
    "linkedBugIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
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

    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bug_projectId_idx" ON "Bug"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Bug_projectId_sourceBugId_key" ON "Bug"("projectId", "sourceBugId");

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_linkedTestCaseId_fkey" FOREIGN KEY ("linkedTestCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
