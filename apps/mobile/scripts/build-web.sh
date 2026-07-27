#!/usr/bin/env bash
# Build the openframe-frontend STATIC EXPORT and stage it as the Capacitor web
# bundle (www/), inject runtime env, and sync into the native projects.
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
# Override the frontend checkout with FRONTEND_DIR=~/code/openframe-frontend.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${FRONTEND_DIR:-$HOME/flamingo/openframe-frontend}"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "✗ FRONTEND_DIR not found: $FRONTEND_DIR" >&2
  echo "  Set FRONTEND_DIR to your openframe-frontend checkout." >&2
  exit 1
fi

echo "▸ Building openframe-frontend static export ($FRONTEND_DIR)…"
( cd "$FRONTEND_DIR" && OPENFRAME_BUILD_TARGET=export npm run build )

echo "▸ Staging export bundle → www/"
rm -rf "$HERE/www"
cp -R "$FRONTEND_DIR/dist" "$HERE/www"

echo "▸ Injecting runtime env (window.__ENV)…"
node "$HERE/scripts/inject-env.mjs"

echo "▸ Syncing into native projects…"
( cd "$HERE" && npx cap sync )

echo "✓ web bundle staged. Next: npx cap open ios"
