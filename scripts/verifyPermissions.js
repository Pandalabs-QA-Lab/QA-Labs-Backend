require('dotenv').config();
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { signToken } = require('../src/lib/jwt');

async function main() {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL).hostname), 'Local database only');
  const users = [];
  let workspace, server;
  let checks = 0;
  try {
    for (const role of ['QA_LEAD', 'TESTER', 'VIEWER', 'PROJECT_VIEWER', 'INVITEE']) {
      const user = await prisma.user.create({ data: {
        email: `permission-${crypto.randomUUID()}@example.invalid`, displayName: `Disposable ${role}`, passwordHash: 'no-login-test-account',
      } });
      users.push({ ...user, role });
    }
    workspace = await prisma.workspace.create({ data: { name: 'Disposable permission verification', ownerId: users[0].id } });
    for (const user of users.slice(0, 4)) {
      await prisma.membership.create({ data: { workspaceId: workspace.id, userId: user.id,
        role: user.role === 'PROJECT_VIEWER' ? 'VIEWER' : user.role, scope: user.role === 'PROJECT_VIEWER' ? 'PROJECT' : 'WORKSPACE' } });
    }
    const member = await prisma.teamMember.create({ data: { workspaceId: workspace.id, userId: users[3].id, name: users[3].displayName } });
    const project = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'Assigned project', memberIds: [member.id] } });
    const other = await prisma.project.create({ data: { workspaceId: workspace.id, name: 'Private project' } });
    const tc = await prisma.testCase.create({ data: { projectId: project.id, title: 'Permission case' } });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const tokens = new Map();
    const call = async (user, method, path, body, status) => {
      if (!tokens.has(user.id)) tokens.set(user.id, signToken({ userId: user.id, workspaceId: workspace.id }));
      const response = await fetch(`${base}${path}`, { method, headers: {
        Authorization: `Bearer ${tokens.get(user.id)}`, 'Content-Type': 'application/json',
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json().catch(() => null);
      assert.equal(response.status, status, `${user.role} ${method} ${path}: ${JSON.stringify(result)}`);
      checks++;
      return result;
    };
    for (const user of users.slice(0, 4)) {
      await call(user, 'GET', `/projects/${project.id}/test-cases`, undefined, 200);
      if (user.role !== 'QA_LEAD') {
        for (const resource of ['test-cases', 'requirements', 'test-plans', 'milestones', 'folders']) {
          await call(user, 'POST', `/projects/${project.id}/${resource}`, { title: 'Denied', name: 'Denied' }, 403);
        }
        await call(user, 'DELETE', `/projects/${project.id}/test-cases/${tc.id}`, undefined, 403);
        await call(user, 'GET', '/backup/export', undefined, 403);
        await call(user, 'GET', '/access/admin/overview', undefined, 403);
        await call(user, 'POST', '/invites/managed', {}, 403);
      }
    }
    await call(users[1], 'PATCH', `/projects/${project.id}/test-cases/${tc.id}`, { status: 'Pass', actual: 'Passed in staging' }, 200);
    await call(users[1], 'PATCH', `/projects/${project.id}/test-cases/${tc.id}`, { title: 'Unauthorized edit' }, 403);
    await call(users[2], 'PATCH', `/projects/${project.id}/test-cases/${tc.id}`, { status: 'Fail' }, 403);
    await call(users[1], 'POST', `/projects/${project.id}/test-runs`, { name: 'Tester run', cases: [{ testCaseId: tc.id, title: tc.title, status: 'Pass' }] }, 201);
    await call(users[2], 'POST', `/projects/${project.id}/test-runs`, { name: 'Viewer run' }, 403);
    await call(users[3], 'GET', `/projects/${other.id}/test-cases`, undefined, 404);
    const scoped = await call(users[3], 'GET', '/projects', undefined, 200);
    assert.deepEqual(scoped.map((row) => row.id), [project.id]);
    const invite = await call(users[0], 'POST', '/invites/managed', { email: users[4].email, projectId: project.id }, 201);
    await call(users[2], 'POST', `/invites/${invite.token}/accept`, {}, 403);
    const accepted = await call(users[4], 'POST', `/invites/${invite.token}/accept`, {}, 200);
    assert.equal(accepted.role, 'VIEWER');
    assert.equal(accepted.scope, 'PROJECT');
    await call(users[4], 'GET', `/projects/${project.id}/test-cases`, undefined, 200);
    await call(users[4], 'GET', `/projects/${other.id}/test-cases`, undefined, 404);
    await call(users[4], 'POST', `/invites/${invite.token}/accept`, {}, 404);
    const revoked = await call(users[0], 'POST', '/invites/managed', { email: users[4].email }, 201);
    await call(users[0], 'DELETE', `/invites/managed/${revoked.id}`, undefined, 204);
    await call(users[4], 'POST', `/invites/${revoked.token}/accept`, {}, 404);
    const expired = await call(users[0], 'POST', '/invites/managed', { email: users[4].email }, 201);
    await prisma.invitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await call(users[4], 'POST', `/invites/${expired.token}/accept`, {}, 404);
    const plan = await call(users[0], 'POST', `/projects/${project.id}/test-plans`, { name: 'Lead plan' }, 201);
    const plannedRun = await call(users[1], 'POST', `/projects/${project.id}/test-runs`, { name: 'Tester planned run', testPlanId: plan.id }, 201);
    assert.equal(plannedRun.testPlanId, plan.id);
    const privatePlan = await prisma.testPlan.create({ data: { projectId: other.id, name: 'Private plan' } });
    const countBefore = await prisma.testRun.count({ where: { projectId: project.id } });
    await call(users[1], 'POST', `/projects/${project.id}/test-runs`, { name: 'Wrong plan', testPlanId: privatePlan.id }, 404);
    assert.equal(await prisma.testRun.count({ where: { projectId: project.id } }), countBefore);
    const admin = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
    assert.ok(admin);
    await call({ ...admin, role: 'PLATFORM_ADMIN' }, 'GET', '/access/admin/overview', undefined, 200);
    // The same signed token must lose write access immediately after demotion.
    await prisma.membership.update({ where: { userId_workspaceId: { userId: users[1].id, workspaceId: workspace.id } }, data: { role: 'VIEWER' } });
    await call(users[1], 'PATCH', `/projects/${project.id}/test-cases/${tc.id}`, { status: 'Fail' }, 403);
    await prisma.membership.delete({ where: { userId_workspaceId: { userId: users[2].id, workspaceId: workspace.id } } });
    await call(users[2], 'GET', `/projects/${project.id}/test-cases`, undefined, 403);
    await call({ ...admin, role: 'PLATFORM_ADMIN' }, 'DELETE', `/access/admin/users/${users[2].id}`, undefined, 200);
    await call(users[2], 'GET', '/auth/me', undefined, 401);
    assert.equal((await prisma.testCase.findUnique({ where: { id: tc.id } })).title, 'Permission case');
    console.log(`PASS: ${checks} real HTTP permission checks, including role changes, removed membership, project isolation and platform admin access.`);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (workspace) await prisma.workspace.delete({ where: { id: workspace.id } });
    for (const user of users) await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
