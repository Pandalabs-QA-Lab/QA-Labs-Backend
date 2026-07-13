const { z } = require('zod');

const caseSnapshotSchema = z.object({
  testCaseId: z.string(),
  title: z.string().optional().default(''),
  module: z.string().optional().default(''),
  priority: z.string().optional().default(''),
  assignee: z.string().optional().default(''),
  expected: z.string().optional().default(''),
  status: z.string().optional().default(''),
  actual: z.string().optional().default(''),
  bugId: z.string().nullable().optional(),
  linkedBugId: z.string().nullable().optional(),
  linkedBugIds: z.array(z.string()).optional(),
});

const rawFields = {
  name: z.string().trim().min(1, 'Run name is required'),
  build: z.string(),
  environment: z.string(),
  notes: z.string(),
  cases: z.array(caseSnapshotSchema),
  linkedBugIds: z.array(z.string()),
  completedAt: z.string().nullable(),
};

const createTestRunSchema = z.object({
  name: rawFields.name,
  build: rawFields.build.optional().default(''),
  environment: rawFields.environment.optional().default(''),
  notes: rawFields.notes.optional().default(''),
  cases: rawFields.cases.optional().default([]),
  linkedBugIds: rawFields.linkedBugIds.optional().default([]),
  completedAt: rawFields.completedAt.optional(),
});

const updateTestRunSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

const runDraftSchema = z.object({
  runName: z.string().optional().default(''),
  build: z.string().optional().default(''),
  testPlanId: z.string().nullable().optional(),
  linkedRequirementId: z.string().nullable().optional(),
  selectedIds: z.array(z.string()).optional().default([]),
  currentIndex: z.number().int().optional().default(0),
  results: z.record(z.string(), z.object({
    status: z.string().optional(),
    actual: z.string().optional(),
    bugId: z.string().nullable().optional(),
  })).optional().default({}),
  bugsLogged: z.number().int().optional().default(0),
  loggedBugIds: z.array(z.string()).optional().default([]),
  loggedBugCaseIds: z.array(z.string()).optional().default([]),
});

module.exports = { createTestRunSchema, updateTestRunSchema, runDraftSchema };
