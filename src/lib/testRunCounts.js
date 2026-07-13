const { normalizeTestStatus } = require('./statusNormalize');

const STATUS_TO_COUNT_KEY = {
  PASS: 'passed',
  FAIL: 'failed',
  BLOCKER: 'blocker',
  SKIPPED: 'skipped',
  NOT_EXECUTED: 'pending',
  REPORTED: 'reported',
  TESTING_IN_PROGRESS: 'inProgress',
  HOLD: 'hold',
  NEED_CLARIFICATION: 'needClarification',
};

function computeRunCounts(cases) {
  const counts = {
    total: cases.length, passed: 0, failed: 0, blocker: 0, skipped: 0,
    pending: 0, reported: 0, inProgress: 0, hold: 0, needClarification: 0,
  };
  for (const c of cases) {
    const key = STATUS_TO_COUNT_KEY[normalizeTestStatus(c.status)];
    if (key) counts[key] += 1;
  }
  return counts;
}

module.exports = { computeRunCounts };
