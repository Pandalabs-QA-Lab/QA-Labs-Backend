-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "folderId" TEXT;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "ProjectFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFolder_projectId_parentId_idx" ON "ProjectFolder"("projectId", "parentId");

-- CreateIndex
CREATE INDEX "Requirement_folderId_idx" ON "Requirement"("folderId");

-- CreateIndex
CREATE INDEX "TestCase_folderId_idx" ON "TestCase"("folderId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A folder name is unique among siblings, including at the project root.
CREATE UNIQUE INDEX "ProjectFolder_sibling_name_key" ON "ProjectFolder"("projectId", COALESCE("parentId", ''), "name");

-- Preserve existing flat test-case folders as top-level project folders.
INSERT INTO "ProjectFolder" ("id", "projectId", "name", "updatedAt")
SELECT gen_random_uuid()::text, legacy."projectId", legacy."folder", CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "projectId", "folder"
  FROM "TestCase"
  WHERE "folder" <> ''
) AS legacy;

UPDATE "TestCase" AS tc
SET "folderId" = pf."id"
FROM "ProjectFolder" AS pf
WHERE tc."projectId" = pf."projectId" AND tc."folder" = pf."name";
