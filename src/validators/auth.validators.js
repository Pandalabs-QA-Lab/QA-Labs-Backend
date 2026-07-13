const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().trim().min(1, 'Display name is required'),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required'),
});

module.exports = { registerSchema, loginSchema, updateMeSchema };
