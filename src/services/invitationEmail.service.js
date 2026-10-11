const nodemailer = require('nodemailer');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function configuration(env = process.env) {
  let appUrl;
  try {
    appUrl = new URL(env.APP_PUBLIC_URL);
    if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password) return null;
  } catch { return null; }
  const port = Number(env.SMTP_PORT || 587);
  if (!env.SMTP_HOST || !env.SMTP_FROM || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) return null;
  return {
    from: env.SMTP_FROM, appUrl,
    transport: {
      host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === 'true' || port === 465,
      requireTLS: Boolean(env.SMTP_USER),
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    },
  };
}

function message(invite, config) {
  const url = new URL(config.appUrl);
  url.hash = `/join/${encodeURIComponent(invite.token)}`;
  const target = invite.projectName ? `${invite.projectName} (${invite.workspaceName})` : invite.workspaceName;
  const scope = invite.projectName ? 'this project' : 'this workspace and its projects';
  const expiry = new Date(invite.expiresAt).toUTCString();
  return {
    from: config.from, to: invite.email,
    subject: `You're invited to ${target.replace(/[\r\n]/g, ' ')} on QA Lab`,
    text: `You're invited to ${target}.\n\nYou'll start with Viewer access to ${scope}. Your administrator can change your role later.\n\nSign in or create an account using ${invite.email}, then accept your invitation:\n${url.href}\n\nExpires: ${expiry}. If you weren't expecting this invitation, you can ignore it.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6;color:#182230"><h1>You're invited to QA Lab</h1><p>Join <strong>${escapeHtml(target)}</strong> with Viewer access to ${escapeHtml(scope)}.</p><p>Sign in or create an account using <strong>${escapeHtml(invite.email)}</strong>.</p><p><a style="display:inline-block;background:#be185d;color:white;padding:12px 20px;border-radius:8px;text-decoration:none" href="${escapeHtml(url.href)}">Accept invitation</a></p><p>Or open this link: <a href="${escapeHtml(url.href)}">${escapeHtml(url.href)}</a></p><p>Your administrator can change your role later.</p><p>Expires: ${escapeHtml(expiry)}.</p><p>If you weren't expecting this invitation, you can ignore it.</p></div>`,
  };
}

async function send(invite, { env = process.env, createTransport = nodemailer.createTransport } = {}) {
  const config = configuration(env);
  if (!config) return { emailStatus: 'NOT_CONFIGURED' };
  let transport;
  try {
    transport = createTransport(config.transport);
    const result = await transport.sendMail(message(invite, config));
    if (!result.accepted?.some((email) => email.toLowerCase() === invite.email.toLowerCase())) {
      return { emailStatus: 'FAILED' };
    }
    return { emailStatus: 'SENT', emailSentAt: new Date() };
  } catch {
    return { emailStatus: 'FAILED' };
  } finally { transport?.close?.(); }
}

module.exports = { configuration, message, send };
