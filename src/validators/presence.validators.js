const { z } = require('zod');

const heartbeatSchema = z.object({
  currentPage: z.string().optional().default(''),
});

module.exports = { heartbeatSchema };
