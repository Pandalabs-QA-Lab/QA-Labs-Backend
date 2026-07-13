const { z } = require('zod');

const rawFields = {
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string(),
  steps: z.array(z.string()),
};

const createSharedStepSchema = z.object({
  name: rawFields.name,
  description: rawFields.description.optional().default(''),
  steps: rawFields.steps.optional().default([]),
});

const updateSharedStepSchema = z.object(
  Object.fromEntries(Object.entries(rawFields).map(([key, schema]) => [key, schema.optional()])),
);

module.exports = { createSharedStepSchema, updateSharedStepSchema };
