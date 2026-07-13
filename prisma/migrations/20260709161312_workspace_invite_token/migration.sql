-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "inviteToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_inviteToken_key" ON "Workspace"("inviteToken");
