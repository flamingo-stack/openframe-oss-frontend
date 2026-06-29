#!/usr/bin/env node
// Prepend a `window.__ENV` bootstrap to www/index.html so the static bundle can
// resolve its gateway hosts with no server. next-runtime-env's env() reads
// window.__ENV; openframe-frontend's runtime-config.ts also falls back to it.
// Values come from the environment at build time (CI / your shell).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'www', 'index.html');

const env = {
  // The shared auth host (e.g. https://auth.openframe.ai) — tenant discovery,
  // /oauth/login and /oauth/dev-exchange all live there. This is the one var a
  // dynamic-tenant (App Store) build needs.
  NEXT_PUBLIC_SHARED_HOST_URL: process.env.NEXT_PUBLIC_SHARED_HOST_URL || '',
  // Optional single-tenant pin. Without it the shell learns the tenant host at
  // login: /sas/tenant/discover returns the tenant `domain` (newer gateways),
  // and the OAuth callback origin is persisted for cold starts. With it the
  // bundle boots against that tenant directly (dev/self-hosted builds).
  NEXT_PUBLIC_TENANT_HOST_URL: process.env.NEXT_PUBLIC_TENANT_HOST_URL || '',
  NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER: process.env.NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER || 'true',
  NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE || 'oss-tenant',
};

if (!env.NEXT_PUBLIC_SHARED_HOST_URL) {
  // Auth URLs (discovery, /oauth/*, refresh) are built from the SHARED host;
  // without it they go out as relative paths and resolve against the WebView
  // origin (capacitor://localhost) — sign-in breaks. Fail the build rather than
  // ship a bundle that renders but 401s every call.
  console.error(
    '✗ NEXT_PUBLIC_SHARED_HOST_URL is required but not set — auth/discovery calls ' +
      'would hit capacitor://localhost and every request would fail. Aborting.',
  );
  process.exit(1);
}

const snippet = `<script>window.__ENV = ${JSON.stringify(env)};</script>`;
let html = readFileSync(indexPath, 'utf8');

if (/<script>window\.__ENV/.test(html)) {
  html = html.replace(/<script>window\.__ENV[\s\S]*?<\/script>/, snippet);
} else {
  html = html.replace('<head>', `<head>${snippet}`);
}

writeFileSync(indexPath, html);
console.log('▸ injected window.__ENV:', env);
