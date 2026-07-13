-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "build" TEXT NOT NULL DEFAULT '',
    "environment" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "executedByName" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "blocker" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "reported" INTEGER NOT NULL DEFAULT 0,
    "inProgress" INTEGER NOT NULL DEFAULT 0,
    "hold" INTEGER NOT NULL DEFAULT 0,
    "needClarification" INTEGER NOT NULL DEFAULT 0,
    "cases" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "linkedBugIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bugsLogged" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runName" TEXT NOT NULL DEFAULT '',
    "build" TEXT NOT NULL DEFAULT '',
    "selectedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentIndex" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bugsLogged" INTEGER NOT NULL DEFAULT 0,
    "loggedBugIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loggedBugCaseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "RunDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestRun_projectId_idx" ON "TestRun"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RunDraft_projectId_key" ON "RunDraft"("projectId");

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunDraft" ADD CONSTRAINT "RunDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
