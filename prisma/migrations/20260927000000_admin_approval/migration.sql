ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WorkspaceRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TEAM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "workspaceId" TEXT,
    CONSTRAINT "WorkspaceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkspaceRequest_userId_status_idx" ON "WorkspaceRequest"("userId", "status");
CREATE INDEX "WorkspaceRequest_status_createdAt_idx" ON "WorkspaceRequest"("status", "createdAt");
ALTER TABLE "WorkspaceRequest" ADD CONSTRAINT "WorkspaceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
