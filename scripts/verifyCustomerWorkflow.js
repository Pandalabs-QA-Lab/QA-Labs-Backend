require('dotenv').config();
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { signToken } = require('../src/lib/jwt');

async function main() {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database only');
  const frontend = path.resolve(__dirname, '../../QA-Labs-Frontend/src/utils');
  const { getPlanMetrics } = await import(pathToFileURL(path.join(frontend, 'planMetrics.js')));
  const { getProjectReportMetrics } = await import(pathToFileURL(path.join(frontend, 'reportMetrics.js')));
  const { buildLatestStatusMap, getRequirementCoverage } = await import(pathToFileURL(path.join(frontend, 'coverageMetrics.js')));
  let workspace, server;
  const users = [];
  let requests = 0;
  try {
    for (const role of ['QA_LEAD', 'TESTER']) {
      users.push(await prisma.user.create({ data: { email: `workflow-${crypto.randomUUID()}@example.invalid`, displayName: `Workflow ${role}`, passwordHash: 'no-login-test-account' } }));
    }
    workspace = await prisma.workspace.create({ data: { name: 'Disposable customer workflow', ownerId: users[0].id } });
    for (const [i, user] of users.entries()) {
      await prisma.membership.create({ data: { userId: user.id, workspaceId: workspace.id, role: i ? 'TESTER' : 'QA_LEAD' } });
    }
    const project = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'ShopEasy workflow verification' } });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/projects/${project.id}`;
    const tokens = users.map(user => signToken({ userId: user.id, workspaceId: workspace.id }));
    async function call(method, resource, body, tester = false) {
      const response = await fetch(`${base}/${resource}`, { method, headers: { Authorization: `Bearer ${tokens[tester ? 1 : 0]}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json();
      assert.equal(response.status, method === 'POST' ? 201 : 200, `${method} ${resource}: ${JSON.stringify(result)}`);
      requests++;
      return result;
    }
    const folder = await call('POST', 'folders', { name: 'Checkout' });
    const child = await call('POST', 'folders', { name: 'Payment', parentId: folder.id });
    const req = await call('POST', 'requirements', { title: 'Customer can pay for their cart', folderId: child.id, acceptanceCriteria: ['Successful payment creates one order', 'Declined payment does not create an order'] });
    const cases = [];
    for (const title of ['Successful card payment', 'Declined card payment']) {
      cases.push(await call('POST', 'test-cases', { title, folderId: child.id, steps: ['Add a product to cart', 'Submit card payment'], expected: title.startsWith('Successful') ? 'One order created' : 'No order created' }));
    }
    await call('PATCH', `requirements/${req.id}`, { testCaseIds: cases.map(c => c.id) });
    const plan = await call('POST', 'test-plans', { name: 'Checkout release check', requirementIds: [req.id], testCaseIds: [cases[1].id] });
    await call('PATCH', `test-cases/${cases[0].id}`, { status: 'Pass', actual: 'One order created' }, true);
    await call('PATCH', `test-cases/${cases[1].id}`, { status: 'Fail', actual: 'Order incorrectly created for declined payment' }, true);
    const bug = await call('POST', 'bugs', { title: 'Declined card creates an order', linkedTestCaseId: cases[1].id, linkedRequirementId: req.id, environment: 'Local verification', actual: 'Order incorrectly created', expected: 'No order created' }, true);
    await call('POST', 'test-runs', { name: 'Checkout initial execution', testPlanId: plan.id, completedAt: '2026-10-01T08:00:00Z', linkedBugIds: [bug.id], cases: cases.map((c, i) => ({ testCaseId: c.id, title: c.title, status: i ? 'Fail' : 'Pass', ...(i ? { bugId: bug.id } : {}) })) }, true);

    async function reloadAndCheck(passRate, openBugs) {
      // Fresh HTTP reads verify persisted state, rather than the POST response or a client cache.
      const saved = {};
      for (const resource of ['requirements', 'test-cases', 'test-plans', 'test-runs', 'bugs', 'folders']) saved[resource] = await call('GET', resource);
      assert.deepEqual(saved.requirements[0].acceptanceCriteria, req.acceptanceCriteria);
      assert.deepEqual(saved.requirements[0].testCaseIds, cases.map(c => c.id));
      assert.equal(saved.folders.find(f => f.id === child.id).parentId, folder.id);
      assert.equal(saved['test-cases'].every(c => c.folderId === child.id), true);
      assert.equal(saved.bugs[0].linkedTestCaseId, cases[1].id);
      assert.equal(saved.bugs[0].linkedRequirementId, req.id);
      const metrics = getPlanMetrics(saved['test-plans'][0], saved['test-runs'], saved.requirements, saved['test-cases'], saved.bugs);
      const report = getProjectReportMetrics({ project, testCases: saved['test-cases'], bugs: saved.bugs, runs: saved['test-runs'] });
      assert.equal(metrics.scopeTotal, 2);
      assert.equal(metrics.progressPct, 100);
      assert.equal(metrics.passRate, passRate);
      const coverage = getRequirementCoverage(saved.requirements[0], new Map(saved['test-cases'].map(c => [c.id, c])), buildLatestStatusMap(saved['test-runs']));
      assert.equal(coverage.pct, passRate);
      assert.equal(coverage.verdict, passRate === 100 ? 'Verified' : 'Failing');
      assert.equal(report.passRate, passRate);
      assert.equal(report.openBugs, openBugs);
      assert.equal(metrics.bugCount, 1);
      assert.equal(saved['test-runs'].every(r => r.testPlanId === plan.id), true);
      assert.equal(saved['test-runs'].every(r => r.total === 2), true);
      return report;
    }
    await reloadAndCheck(50, 1);
    await call('PATCH', `test-cases/${cases[1].id}`, { status: 'Pass', actual: 'Declined payment creates no order after fix' }, true);
    await call('PATCH', `bugs/${bug.id}`, { status: 'Closed', retestStatus: 'Pass', fixedInBuild: 'local-v2' }, true);
    const retest = await call('POST', 'test-runs', { name: 'Checkout retest', testPlanId: plan.id, completedAt: '2026-10-01T09:00:00Z', cases: cases.map(c => ({ testCaseId: c.id, title: c.title, status: 'Pass' })) }, true);
    assert.equal(retest.passed, 2);
    assert.equal((await reloadAndCheck(100, 0)).latestRun.id, retest.id);
    console.log(`PASS: ${requests} real HTTP requests; nested folders, acceptance criteria, linked cases, plan execution as Tester, linked bug, retest and persisted report consistency.`);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (workspace) await prisma.workspace.delete({ where: { id: workspace.id } });
    for (const user of users) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
