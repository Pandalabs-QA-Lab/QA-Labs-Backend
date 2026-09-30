ALTER TABLE "Requirement" ADD COLUMN "acceptanceCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
