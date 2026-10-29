// Uploads the build's browser source maps to Sentry and deletes them from the output, so they are never served.
// A no-op without SENTRY_AUTH_TOKEN — every build but a release lane's. Each lane names its own SENTRY_PROJECT:
// the web image, the desktop bundle and the mobile bundle report to different projects. Files are matched by the
// debug ids `inject` writes into them, so no release name has to line up.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.SENTRY_AUTH_TOKEN) process.exit(0);
for (const name of ['SENTRY_ORG', 'SENTRY_PROJECT']) {
  if (!process.env[name]) {
    console.error(`✗ SENTRY_AUTH_TOKEN is set but ${name} is not.`);
    process.exit(1);
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// standalone writes client chunks to dist/static, the static export to dist/_next/static.
const dir = [join(root, 'dist/_next/static'), join(root, 'dist/static')].find(existsSync);
if (!dir) {
  console.error('✗ No client chunks under dist/ — run after `next build`.');
  process.exit(1);
}

const cli = createRequire(import.meta.url).resolve('@sentry/cli/bin/sentry-cli');
for (const command of ['inject', 'upload']) {
  execFileSync(process.execPath, [cli, 'sourcemaps', command, dir], { stdio: 'inherit' });
}

for (const file of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
  if (file.endsWith('.map')) rmSync(join(dir, file));
}
