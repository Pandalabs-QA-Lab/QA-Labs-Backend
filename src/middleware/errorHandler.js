const { ZodError } = require('zod');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || 'Invalid request', issues: err.issues });
  }
  const databaseUnavailable = ['P1001', 'P1002', 'P1008'].includes(err.code);
  const status = databaseUnavailable ? 503 : (err.status || 500);
  if (status >= 500) {
    console.error(err);
  }
  const message = databaseUnavailable
    ? 'Database is temporarily unavailable. Please try again shortly.'
    : status >= 500 ? 'Internal server error' : (err.message || 'Request failed');
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
