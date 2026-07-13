const { z } = require('zod');

const rawFields = {
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string(),
  requirementIds: z.array(z.string()),
  milestoneId: z.string().nullable(),
  status: z.string(),
  testCaseIds: z.array(z.string()),
  completedAt: z.string().nullable(),
};

const createTestPlanSchema = z.object({
  name: rawFields.name,
  description: rawFields.description.optional().default(''),
  requirementIds: rawFields.requirementIds.optional().default([]),
  milestoneId: rawFields.milestoneId.optional(),
  status: rawFields.status.optional().default('Open'),
  testCaseIds: rawFields.testCaseIds.optional().default([]),
});

const updateTestPlanSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

const linkRunSchema = z.object({ runId: z.string() });

module.exports = { createTestPlanSchema, updateTestPlanSchema, linkRunSchema };
