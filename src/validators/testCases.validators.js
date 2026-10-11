const { z } = require('zod');

const evidenceLinkSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  label: z.string().optional().default(''),
  addedAt: z.string().optional(),
  addedBy: z.string().optional(),
});

// Raw (no defaults) - used for update, where an absent key must mean
// "leave this field alone", not "reset it to empty".
const rawFields = {
  sourceTcId: z.string().trim(),
  title: z.string().trim().min(1, 'Title is required'),
  module: z.string(),
  folder: z.string(),
  folderId: z.string().uuid().nullable().or(z.literal('')).transform((v) => v || null),
  scenario: z.string(),
  preconditions: z.string(),
  steps: z.array(z.string()),
  testData: z.string(),
  expected: z.string(),
  actual: z.string(),
  status: z.string(),
  priority: z.string(),
  assignee: z.string(),
  devRemarks: z.string(),
  qaRemarks: z.string(),
  evidenceLinks: z.array(evidenceLinkSchema),
  tags: z.array(z.string()),
};

const createTestCaseSchema = z.object({
  sourceTcId: rawFields.sourceTcId.optional(),
  title: rawFields.title,
  module: rawFields.module.optional().default(''),
  folder: rawFields.folder.optional().default(''),
  folderId: rawFields.folderId.optional(),
  scenario: rawFields.scenario.optional().default(''),
  preconditions: rawFields.preconditions.optional().default(''),
  steps: rawFields.steps.optional().default([]),
  testData: rawFields.testData.optional().default(''),
  expected: rawFields.expected.optional().default(''),
  actual: rawFields.actual.optional().default(''),
  status: rawFields.status.optional(),
  priority: rawFields.priority.optional(),
  assignee: rawFields.assignee.optional().default(''),
  devRemarks: rawFields.devRemarks.optional().default(''),
  qaRemarks: rawFields.qaRemarks.optional().default(''),
  evidenceLinks: rawFields.evidenceLinks.optional(),
  tags: rawFields.tags.optional().default([]),
});

// Every field optional, no defaults - absent keys are stripped before
// being passed to Prisma's update() so they never overwrite existing data.
const updateTestCaseSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

const bulkCreateSchema = z.object({
  rows: z.array(createTestCaseSchema),
});

module.exports = { createTestCaseSchema, updateTestCaseSchema, bulkCreateSchema };
