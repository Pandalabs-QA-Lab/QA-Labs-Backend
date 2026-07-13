const { z } = require('zod');

const listCommentsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

const createCommentSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  text: z.string().min(1),
  entityTitle: z.string().optional().default(''),
  entityOwnerName: z.string().optional().default(''),
});

module.exports = { listCommentsSchema, createCommentSchema };
