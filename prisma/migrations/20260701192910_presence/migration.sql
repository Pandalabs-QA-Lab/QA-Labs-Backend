-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "currentPage" TEXT NOT NULL DEFAULT '',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presence_projectId_idx" ON "Presence"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_projectId_userId_key" ON "Presence"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
