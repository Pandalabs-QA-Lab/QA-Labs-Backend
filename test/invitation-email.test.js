const test = require('node:test');
const assert = require('node:assert/strict');
const mail = require('../src/services/invitationEmail.service');
const net = require('node:net');

const env = { SMTP_HOST: 'smtp.example.test', SMTP_FROM: 'QA Lab <hello@example.test>',
  SMTP_PORT: '465', SMTP_USER: 'hello@example.test', SMTP_PASSWORD: 'test-only',
  APP_PUBLIC_URL: 'https://app.example.test/QA-Labs-Frontend/' };
const invite = { email: 'invitee@example.test', token: 'token123', workspaceName: 'Team <script>',
  projectName: 'Checkout & payments', expiresAt: new Date('2027-01-01T00:00:00Z') };

test('missing mail credentials never attempts delivery', async () => {
  const result = await mail.send(invite, { env: { ...env, SMTP_PASSWORD: '' },
    createTransport: () => { assert.fail('Transport must not be created'); } });
  assert.equal(result.emailStatus, 'NOT_CONFIGURED');
  assert.equal(mail.configuration({ ...env, APP_PUBLIC_URL: 'javascript:alert(1)' }), null);
});

test('invitation email preserves app base path and explains scoped Viewer access', async () => {
  let sent;
  let options;
  const result = await mail.send(invite, { env, createTransport: (config) => {
    options = config;
    return { sendMail: async (message) => { sent = message; return { accepted: [invite.email] }; } };
  } });
  assert.equal(result.emailStatus, 'SENT');
  assert.ok(result.emailSentAt instanceof Date);
  assert.equal(options.secure, true);
  assert.equal(sent.to, invite.email);
  assert.match(sent.text, /Viewer access to this project/);
  assert.match(sent.text, /https:\/\/app.example.test\/QA-Labs-Frontend\/#\/join\/token123/);
  assert.match(sent.html, /Team &lt;script&gt;/);
  assert.doesNotMatch(sent.html, /<script>/);
  assert.match(sent.text, /01 Jan 2027/);
});

test('provider rejections and errors report failure without exposing credentials', async () => {
  const refused = await mail.send(invite, { env, createTransport: () => ({ sendMail: async () => ({ accepted: [] }) }) });
  const failed = await mail.send(invite, { env, createTransport: () => ({ sendMail: async () => { throw new Error('password test-only'); } }) });
  assert.deepEqual(refused, { emailStatus: 'FAILED' });
  assert.deepEqual(failed, { emailStatus: 'FAILED' });
});

test('real SMTP transport delivers the invitation to a local test receiver', async () => {
  let body = '';
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 local-test SMTP ready\r\n');
    let buffer = '';
    let readingBody = false;
    socket.on('data', (data) => {
      buffer += data.toString();
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (readingBody && line !== '.') { body += line + '\r\n'; continue; }
        if (readingBody) { readingBody = false; socket.write('250 queued\r\n'); }
        else if (/^EHLO/.test(line)) socket.write('250 local-test\r\n');
        else if (line === 'DATA') { readingBody = true; socket.write('354 send message\r\n'); }
        else if (line === 'QUIT') socket.end('221 goodbye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await mail.send(invite, { env: { ...env, SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(server.address().port), SMTP_SECURE: 'false', SMTP_USER: '', SMTP_PASSWORD: '' } });
    assert.equal(result.emailStatus, 'SENT');
    assert.match(body, /invitee@example.test/);
    assert.match(body, /token123/);
    assert.match(body, /Viewer/);
  } finally { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); }
});
