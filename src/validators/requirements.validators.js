const { z } = require('zod');

const rawFields = {
  key: z.string().nullable().optional(),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  acceptanceCriteria: z.array(z.string().trim().min(1)),
  folderId: z.string().uuid().nullable().or(z.literal('')).transform((v) => v || null),
  priority: z.string(),
  testCaseIds: z.array(z.string()),
};

const createRequirementSchema = z.object({
  key: rawFields.key,
  title: rawFields.title,
  description: rawFields.description.optional().default(''),
  acceptanceCriteria: rawFields.acceptanceCriteria.optional().default([]),
  folderId: rawFields.folderId.optional(),
  priority: rawFields.priority.optional().default('Medium'),
  testCaseIds: rawFields.testCaseIds.optional().default([]),
});

const updateRequirementSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

const bulkCreateSchema = z.object({ rows: z.array(createRequirementSchema) });

module.exports = { createRequirementSchema, updateRequirementSchema, bulkCreateSchema };
