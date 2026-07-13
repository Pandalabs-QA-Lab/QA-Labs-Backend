const prisma = require('../lib/prisma');
const HttpError = require('../lib/httpError');

// Everything here is served with zero authentication, so it must only ever
// select aggregate counts and the handful of run fields the trend chart
// needs - never raw test case / bug rows (titles, descriptions, steps, etc).
async function getPublicReport(shareToken) {
  const project = await prisma.project.findFirst({
    where: { publicShareToken: shareToken, deleted: false },
  });
  if (!project) throw new HttpError(404, 'Report not available or sharing has been disabled');

  const [testCases, bugs, runs] = await Promise.all([
    prisma.testCase.findMany({ where: { projectId: project.id, deleted: false }, select: { status: true } }),
    prisma.bug.findMany({ where: { projectId: project.id, deleted: false }, select: { status: true, severity: true } }),
    prisma.testRun.findMany({
      where: { projectId: project.id, deleted: false },
      select: { name: true, date: true, completedAt: true, total: true, passed: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  const total = testCases.length;
  const counts = { passed: 0, failed: 0, blocker: 0, skipped: 0, pending: 0, reported: 0, inProgress: 0, hold: 0, needClarification: 0 };
  testCases.forEach((tc) => {
    if (tc.status === 'PASS') counts.passed++;
    else if (tc.status === 'FAIL') counts.failed++;
    else if (tc.status === 'BLOCKER') counts.blocker++;
    else if (tc.status === 'SKIPPED') counts.skipped++;
    else if (tc.status === 'REPORTED') counts.reported++;
    else if (tc.status === 'TESTING_IN_PROGRESS') counts.inProgress++;
    else if (tc.status === 'HOLD') counts.hold++;
    else if (tc.status === 'NEED_CLARIFICATION') counts.needClarification++;
    else counts.pending++;
  });
  const passRate = total ? Math.round((counts.passed / total) * 100) : 0;
  const coverage = total ? Math.round(((total - counts.pending) / total) * 100) : 0;

  const activeBugs = bugs.filter((b) => b.status !== 'CLOSED');
  const bugCounts = { critical: 0, major: 0, minor: 0 };
  activeBugs.forEach((b) => {
    if (b.severity === 'CRITICAL') bugCounts.critical++;
    else if (b.severity === 'MAJOR') bugCounts.major++;
    else bugCounts.minor++;
  });
  const openBugs = activeBugs.length;

  let health = { label: 'No cases', tone: 'neutral' };
  if (total > 0) {
    if (counts.blocker > 0 || passRate < 50) health = { label: 'At risk', tone: 'failed' };
    else if (passRate < 70 || openBugs > 0) health = { label: 'Review', tone: 'pending' };
    else health = { label: 'Healthy', tone: 'passed' };
  }

  return {
    project: { name: project.name },
    metrics: { total, ...counts, passRate, coverage, openBugs, ...bugCounts, health },
    runs,
  };
}

module.exports = { getPublicReport };
