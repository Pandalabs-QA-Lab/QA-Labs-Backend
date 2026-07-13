const { z } = require('zod');

const evidenceLinkSchema = z.object({
  id: z.string().optional(),
  url: z.string(),
  label: z.string().optional().default(''),
  addedAt: z.string().optional(),
  addedBy: z.string().optional(),
});

const rawFields = {
  sourceBugId: z.string().trim(),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  module: z.string(),
  severity: z.string(),
  priority: z.string(),
  status: z.string(),
  stepsToReproduce: z.string(),
  expected: z.string(),
  actual: z.string(),
  environment: z.string(),
  build: z.string(),
  fixedInBuild: z.string(),
  assignedTo: z.string(),
  reportedBy: z.string(),
  reportedByName: z.string(),
  reportedDate: z.string(),
  retestStatus: z.string(),
  devRemarks: z.string(),
  qaRemarks: z.string(),
  linkedTestCaseId: z.string().nullable(),
  linkedRequirementId: z.string().nullable(),
  evidenceLinks: z.array(evidenceLinkSchema),
  linkedBugIds: z.array(z.string()),
  tags: z.array(z.string()),
};

const createBugSchema = z.object({
  sourceBugId: rawFields.sourceBugId.optional(),
  title: rawFields.title,
  description: rawFields.description.optional().default(''),
  module: rawFields.module.optional().default(''),
  severity: rawFields.severity.optional(),
  priority: rawFields.priority.optional(),
  status: rawFields.status.optional(),
  stepsToReproduce: rawFields.stepsToReproduce.optional().default(''),
  expected: rawFields.expected.optional().default(''),
  actual: rawFields.actual.optional().default(''),
  environment: rawFields.environment.optional().default(''),
  build: rawFields.build.optional().default(''),
  fixedInBuild: rawFields.fixedInBuild.optional().default(''),
  assignedTo: rawFields.assignedTo.optional().default(''),
  reportedBy: rawFields.reportedBy.optional(),
  reportedByName: rawFields.reportedByName.optional(),
  reportedDate: rawFields.reportedDate.optional(),
  retestStatus: rawFields.retestStatus.optional(),
  devRemarks: rawFields.devRemarks.optional().default(''),
  qaRemarks: rawFields.qaRemarks.optional().default(''),
  linkedTestCaseId: rawFields.linkedTestCaseId.optional(),
  linkedRequirementId: rawFields.linkedRequirementId.optional(),
  evidenceLinks: rawFields.evidenceLinks.optional(),
  linkedBugIds: rawFields.linkedBugIds.optional().default([]),
  tags: rawFields.tags.optional().default([]),
});

const updateBugSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

const bulkCreateSchema = z.object({ rows: z.array(createBugSchema) });

module.exports = { createBugSchema, updateBugSchema, bulkCreateSchema };
