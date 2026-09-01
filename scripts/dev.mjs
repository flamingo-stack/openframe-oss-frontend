#!/usr/bin/env node

/**
 * `npm run dev:proxy` — the dev server WITH working gateway access.
 *
 * Runs two processes as one: the credential-injecting proxy
 * (`scripts/dev-proxy.mjs`) and `next dev` with `OPENFRAME_DEV_PROXY` pointed at
 * it, which is what switches on the whole-gateway rewrites in `next.config.mjs`.
 *
 * One process rather than two terminals, and specifically so they SHARE A FATE:
 * a proxy still holding a live session after its dev server is gone is a
 * credential left listening on a local port with nothing to explain it. Either
 * child exiting takes the other down.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sessionFile = resolve(projectRoot, '.dev-session.json');

if (!existsSync(sessionFile)) {
  console.error(
    '\n  No .dev-session.json — run "npm run dev:login" first.\n' +
      '  (Plain "npm run dev" still works; it just has no gateway access.)\n',
  );
  process.exit(1);
}

const proxyPort = Number(process.env.OPENFRAME_DEV_PROXY_PORT || 7787);
const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code ?? 0);
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  child.on('exit', code => {
    if (!shuttingDown) console.error(`\n  ${name} exited (${code}) — stopping the other half.\n`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('dev-proxy', process.execPath, [resolve(projectRoot, 'scripts/dev-proxy.mjs'), '--port', String(proxyPort)]);
start('next dev', 'npx', ['next', 'dev', '-p', process.env.PORT || '3000'], {
  OPENFRAME_DEV_PROXY: `http://127.0.0.1:${proxyPort}`,
  // Both host vars MUST be empty for this to work: they are what make the
  // client build absolute gateway URLs, and an absolute URL bypasses the
  // rewrites entirely — straight back to the cross-origin request this setup
  // exists to remove. Cleared here rather than trusted to `.env.local`, so one
  // stale line in an untracked file cannot silently disable the proxy.
  NEXT_PUBLIC_TENANT_HOST_URL: '',
  NEXT_PUBLIC_SHARED_HOST_URL: '',
  // Cookie mode, matching the deployment. The dev-ticket observer would flip
  // `isBearerAuthMode()` on, and the app would then look for a bearer token in
  // localStorage that this setup deliberately never puts there.
  NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER: 'false',
});
