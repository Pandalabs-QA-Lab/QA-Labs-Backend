// Ported from the frontend's src/utils/status.js and inline bug-status
// alias maps in reportMetrics.js, so any legacy/alias string the client
// still sends resolves to the same canonical Postgres enum value.

const TEST_STATUS_ALIASES = {
  pass: 'PASS',
  passed: 'PASS',
  fail: 'FAIL',
  failed: 'FAIL',
  pending: 'NOT_EXECUTED',
  'not executed': 'NOT_EXECUTED',
  'not run': 'NOT_EXECUTED',
  '': 'NOT_EXECUTED',
  skip: 'SKIPPED',
  skipped: 'SKIPPED',
  blocker: 'BLOCKER',
  blocked: 'BLOCKER',
  reported: 'REPORTED',
  'need clarification': 'NEED_CLARIFICATION',
  clarification: 'NEED_CLARIFICATION',
  'testing in progress': 'TESTING_IN_PROGRESS',
  'in progress': 'TESTING_IN_PROGRESS',
  inprogress: 'TESTING_IN_PROGRESS',
  hold: 'HOLD',
  'on hold': 'HOLD',
};

function normalizeTestStatus(status) {
  if (!status) return 'NOT_EXECUTED';
  if (['NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKER', 'SKIPPED', 'REPORTED', 'NEED_CLARIFICATION', 'TESTING_IN_PROGRESS', 'HOLD'].includes(status)) {
    return status;
  }
  const key = String(status).trim().toLowerCase();
  return TEST_STATUS_ALIASES[key] || 'NOT_EXECUTED';
}

const PRIORITY_ALIASES = {
  high: 'HIGH',
  med: 'MED',
  medium: 'MED',
  low: 'LOW',
};

function normalizePriority(priority) {
  if (['HIGH', 'MED', 'LOW'].includes(priority)) return priority;
  const key = String(priority || '').trim().toLowerCase();
  return PRIORITY_ALIASES[key] || 'MED';
}

const BUG_SEVERITY_ALIASES = {
  critical: 'CRITICAL',
  major: 'MAJOR',
  minor: 'MINOR',
};

function normalizeBugSeverity(severity) {
  if (['CRITICAL', 'MAJOR', 'MINOR'].includes(severity)) return severity;
  const key = String(severity || '').trim().toLowerCase();
  return BUG_SEVERITY_ALIASES[key] || 'MAJOR';
}

const BUG_PRIORITY_ALIASES = {
  high: 'HIGH',
  medium: 'MEDIUM',
  med: 'MEDIUM',
  low: 'LOW',
};

function normalizeBugPriority(priority) {
  if (['HIGH', 'MEDIUM', 'LOW'].includes(priority)) return priority;
  const key = String(priority || '').trim().toLowerCase();
  return BUG_PRIORITY_ALIASES[key] || 'MEDIUM';
}

const BUG_STATUS_ALIASES = {
  open: 'OPEN',
  'in review': 'IN_REVIEW',
  inreview: 'IN_REVIEW',
  review: 'IN_REVIEW',
  closed: 'CLOSED',
  close: 'CLOSED',
};

function normalizeBugStatus(status) {
  if (['OPEN', 'IN_REVIEW', 'CLOSED'].includes(status)) return status;
  const key = String(status || '').trim().toLowerCase();
  return BUG_STATUS_ALIASES[key] || 'OPEN';
}

const RETEST_STATUS_ALIASES = {
  'not retested': 'NOT_RETESTED',
  passed: 'PASSED',
  pass: 'PASSED',
  failed: 'FAILED',
  fail: 'FAILED',
};

function normalizeRetestStatus(status) {
  if (['NOT_RETESTED', 'PASSED', 'FAILED'].includes(status)) return status;
  const key = String(status || '').trim().toLowerCase();
  return RETEST_STATUS_ALIASES[key] || 'NOT_RETESTED';
}

module.exports = {
  normalizeTestStatus,
  normalizePriority,
  normalizeBugSeverity,
  normalizeBugPriority,
  normalizeBugStatus,
  normalizeRetestStatus,
};
