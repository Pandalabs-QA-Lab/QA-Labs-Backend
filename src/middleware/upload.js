const multer = require('multer');
const env = require('../config/env');

// memoryStorage rather than diskStorage: with diskStorage, the
// destination()/filename() callbacks only see body fields that were
// declared BEFORE the file field in the multipart form, which is a
// fragile ordering requirement. Buffering in memory lets the controller
// write to disk after the full body (including projectId) is parsed and
// validated.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
});

module.exports = upload;
