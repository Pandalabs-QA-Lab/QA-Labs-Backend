const HttpError = require('./httpError');

function normalizeBackupEnumValue(value, {
  fieldName, defaultValue, allowedValues, aliases,
}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value !== 'string') throw new HttpError(400, `Unsupported ${fieldName} value in backup: ${String(value)}`);
  const trimmed = value.trim();
  if (!trimmed) return defaultValue;
  if (allowedValues.has(trimmed)) return trimmed;
  const mapped = aliases[trimmed.toLowerCase()];
  if (mapped) return mapped;
  throw new HttpError(400, `Unsupported ${fieldName} value in backup: "${value}"`);
}

const ROLE_VALUES = new Set(['QA_LEAD', 'TESTER', 'VIEWER']);
const TEST_CASE_STATUS_VALUES = new Set(['NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKER', 'SKIPPED', 'REPORTED', 'NEED_CLARIFICATION', 'TESTING_IN_PROGRESS', 'HOLD']);
const TEST_CASE_PRIORITY_VALUES = new Set(['HIGH', 'MED', 'LOW']);
const BUG_SEVERITY_VALUES = new Set(['CRITICAL', 'MAJOR', 'MINOR']);
const BUG_PRIORITY_VALUES = new Set(['HIGH', 'MEDIUM', 'LOW']);
const BUG_STATUS_VALUES = new Set(['OPEN', 'IN_REVIEW', 'CLOSED']);
const RETEST_STATUS_VALUES = new Set(['NOT_RETESTED', 'PASSED', 'FAILED']);

function normalizeBackupRole(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'team member role',
    defaultValue: 'VIEWER',
    allowedValues: ROLE_VALUES,
    aliases: {
      'qa lead': 'QA_LEAD',
      tester: 'TESTER',
      viewer: 'VIEWER',
    },
  });
}

function normalizeBackupTestCaseStatus(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'test case status',
    defaultValue: 'NOT_EXECUTED',
    allowedValues: TEST_CASE_STATUS_VALUES,
    aliases: {
      pass: 'PASS',
      passed: 'PASS',
      fail: 'FAIL',
      failed: 'FAIL',
      pending: 'NOT_EXECUTED',
      'not executed': 'NOT_EXECUTED',
      'not run': 'NOT_EXECUTED',
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
    },
  });
}

function normalizeBackupTestCasePriority(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'test case priority',
    defaultValue: 'MED',
    allowedValues: TEST_CASE_PRIORITY_VALUES,
    aliases: {
      high: 'HIGH',
      med: 'MED',
      medium: 'MED',
      low: 'LOW',
    },
  });
}

function normalizeBackupBugSeverity(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'bug severity',
    defaultValue: 'MINOR',
    allowedValues: BUG_SEVERITY_VALUES,
    aliases: {
      critical: 'CRITICAL',
      major: 'MAJOR',
      minor: 'MINOR',
    },
  });
}

function normalizeBackupBugPriority(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'bug priority',
    defaultValue: 'MEDIUM',
    allowedValues: BUG_PRIORITY_VALUES,
    aliases: {
      high: 'HIGH',
      med: 'MEDIUM',
      medium: 'MEDIUM',
      low: 'LOW',
    },
  });
}

function normalizeBackupBugStatus(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'bug status',
    defaultValue: 'OPEN',
    allowedValues: BUG_STATUS_VALUES,
    aliases: {
      open: 'OPEN',
      'in review': 'IN_REVIEW',
      inreview: 'IN_REVIEW',
      review: 'IN_REVIEW',
      closed: 'CLOSED',
      close: 'CLOSED',
    },
  });
}

function normalizeBackupRetestStatus(value) {
  return normalizeBackupEnumValue(value, {
    fieldName: 'bug retest status',
    defaultValue: 'NOT_RETESTED',
    allowedValues: RETEST_STATUS_VALUES,
    aliases: {
      'not retested': 'NOT_RETESTED',
      pass: 'PASSED',
      passed: 'PASSED',
      fail: 'FAILED',
      failed: 'FAILED',
    },
  });
}

module.exports = {
  normalizeBackupRole,
  normalizeBackupTestCaseStatus,
  normalizeBackupTestCasePriority,
  normalizeBackupBugSeverity,
  normalizeBackupBugPriority,
  normalizeBackupBugStatus,
  normalizeBackupRetestStatus,
};
