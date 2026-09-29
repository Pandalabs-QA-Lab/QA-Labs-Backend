const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../src/middleware/errorHandler');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('database outages do not expose Prisma details to the browser', () => {
  const res = response();
  const originalError = console.error;
  console.error = () => {};
  try {
    errorHandler({ code: 'P1001', message: 'Invalid prisma.user.findUnique() at C:\\private\\auth.js' }, {}, res);
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'Database is temporarily unavailable. Please try again shortly.');
});

test('unexpected server errors do not expose internal messages', () => {
  const res = response();
  const originalError = console.error;
  console.error = () => {};
  try {
    errorHandler(new Error('private implementation detail'), {}, res);
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'Internal server error');
});
