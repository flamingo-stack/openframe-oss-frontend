#!/usr/bin/env bash
# Build the web app's STATIC EXPORT from this repository and stage it as the
# Capacitor web bundle (www/), inject runtime env, and sync into the native
# projects. The bundle always comes from the same commit as the shell itself.
#
# Dynamic-tenant build (one binary for all tenants — the shell discovers the
# tenant at login via the shared auth host):
#   NEXT_PUBLIC_SHARED_HOST_URL=https://auth.openframe.example \
#   NEXT_PUBLIC_APP_MODE=saas-tenant \
#   npm run build:web
#
# Single-tenant pin (dev / self-hosted — skips discovery-based host learning):
#   add NEXT_PUBLIC_TENANT_HOST_URL=https://acme.openframe.example
#
# A store build is cut from a web release tag, so the bundle is exactly the web
# release prod runs and reports it as its version in X-OpenFrame-Client.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$(cd "$HERE/../web" && pwd)"

if [ ! -d "$WEB_DIR/node_modules" ]; then
  echo "▸ Installing web dependencies…"
  ( cd "$WEB_DIR" && npm ci )
fi

echo "▸ Building static export ($WEB_DIR)…"
( cd "$WEB_DIR" && OPENFRAME_BUILD_TARGET="export" npm run build )

echo "▸ Staging export bundle → www/"
rm -rf "$HERE/www"
cp -R "$WEB_DIR/dist" "$HERE/www"

echo "▸ Injecting runtime env (window.__ENV)…"
node "$HERE/scripts/inject-env.mjs"

echo "▸ Syncing into native projects…"
( cd "$HERE" && npx cap sync )

echo "✓ web bundle staged. Next: npx cap open ios"
