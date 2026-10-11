const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const env = require('../src/config/env');

async function main() {
  const root = path.resolve(env.uploadDir);
  await fs.mkdir(root, { recursive: true });
  const probe = path.join(root, `.storage-check-${crypto.randomUUID()}`);
  const expected = crypto.randomBytes(32);
  try {
    await fs.writeFile(probe, expected, { flag: 'wx', mode: 0o600 });
    if (!(await fs.readFile(probe)).equals(expected)) throw new Error('Storage readback did not match');
    console.log(`Upload directory is readable and writable: ${root}`);
    console.log('This checks access only. Confirm with your host that the directory survives deployments and restarts. Back up uploads alongside the database.');
  } finally {
    await fs.unlink(probe).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

main().catch(error => { console.error(`Upload storage check failed: ${error.message}`); process.exitCode = 1; });
