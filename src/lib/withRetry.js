const { Prisma } = require('@prisma/client');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The canonical-ID assignment (nextTcId/nextBugId) reads the current max ID
// then inserts in the same transaction, but that "read then insert" isn't
// atomic against a concurrent transaction doing the same read before either
// commits - two requests can compute the same next ID. The unique
// constraint on (projectId, sourceTcId/sourceBugId) catches this as a
// P2002 error rather than allowing silent duplicates; retrying recomputes
// the ID against the now-committed data and resolves it transparently.
// Random jitter (rather than immediate retry) matters here: under N-way
// concurrency, colliding requests that all retry at the same instant can
// keep re-colliding with each other in lockstep instead of spreading out.
async function withRetry(fn, attempts = 10) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      const isUniqueConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isUniqueConflict) throw err;
      lastErr = err;
      await sleep(10 + Math.random() * 40 * (i + 1));
    }
  }
  throw lastErr;
}

module.exports = { withRetry };
