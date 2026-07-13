const { z } = require('zod');

const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required'),
  description: z.string().trim().optional().default(''),
  memberIds: z.array(z.string()).optional().default([]),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  memberIds: z.array(z.string()).optional(),
});

module.exports = { createProjectSchema, updateProjectSchema };
