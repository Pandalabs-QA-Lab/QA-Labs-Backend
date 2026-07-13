const { z } = require('zod');

const ROLES = ['QA_LEAD', 'TESTER', 'VIEWER'];

const createTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email().optional(),
  role: z.enum(ROLES).optional().default('VIEWER'),
});

const updateTeamMemberSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1),
});

module.exports = { createTeamMemberSchema, updateTeamMemberSchema, updateWorkspaceSchema };
