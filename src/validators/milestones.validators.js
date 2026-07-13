const { z } = require('zod');

const rawFields = {
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string(),
  dueDate: z.string().nullable(),
  testPlanIds: z.array(z.string()),
  status: z.string(),
  completedAt: z.string().nullable(),
};

const createMilestoneSchema = z.object({
  name: rawFields.name,
  description: rawFields.description.optional().default(''),
  dueDate: rawFields.dueDate.optional(),
  testPlanIds: rawFields.testPlanIds.optional().default([]),
  status: rawFields.status.optional().default('Open'),
});

const updateMilestoneSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

module.exports = { createMilestoneSchema, updateMilestoneSchema };
