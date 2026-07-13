const { z } = require('zod');

const importSchema = z.object({
  backup: z.record(z.string(), z.any()),
  mode: z.enum(['merge', 'replace']),
});

module.exports = { importSchema };
