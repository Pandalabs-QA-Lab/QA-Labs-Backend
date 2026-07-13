-- CreateTable
CREATE TABLE "SharedStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedStep_projectId_idx" ON "SharedStep"("projectId");

-- AddForeignKey
ALTER TABLE "SharedStep" ADD CONSTRAINT "SharedStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
