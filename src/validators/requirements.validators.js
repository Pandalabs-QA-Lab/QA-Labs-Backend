const { z } = require('zod');

const rawFields = {
  key: z.string(),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  priority: z.string(),
  testCaseIds: z.array(z.string()),
};

const createRequirementSchema = z.object({
  key: rawFields.key.optional(),
  title: rawFields.title,
  description: rawFields.description.optional().default(''),
  priority: rawFields.priority.optional().default('Medium'),
  testCaseIds: rawFields.testCaseIds.optional().default([]),
});

const updateRequirementSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

const bulkCreateSchema = z.object({ rows: z.array(createRequirementSchema) });

module.exports = { createRequirementSchema, updateRequirementSchema, bulkCreateSchema };
