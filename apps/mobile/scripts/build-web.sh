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
# Source of the frontend, in order:
#   FRONTEND_REF=1.0.127   a fresh shallow clone of FRONTEND_REPO at that release
#                          tag (a branch works too, for a dev build) into
#                          .frontend/ (git-ignored). What a store build should
#                          use: the bundle is exactly that release, and reports
#                          it as its version in X-OpenFrame-Client.
#   FRONTEND_DIR=<path>    an existing working copy, built as-is — the local dev
#                          loop. Default ~/flamingo/openframe-frontend.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_REPO="${FRONTEND_REPO:-https://github.com/flamingo-stack/openframe-oss-frontend}"
FRONTEND_REF="${FRONTEND_REF:-}"

if [ -n "$FRONTEND_REF" ]; then
  if [ -n "${FRONTEND_DIR:-}" ]; then
    echo "✗ Set FRONTEND_REF or FRONTEND_DIR, not both." >&2
    exit 1
  fi
  # Re-cloned every time rather than refreshed in place: fetching a tag into an
  # existing shallow checkout leaves no local tag ref, so the bundle's
  # `git describe` would report a bare sha instead of the release.
  FRONTEND_DIR="$HERE/.frontend"
  echo "▸ Cloning $FRONTEND_REPO ($FRONTEND_REF) → .frontend/…"
  rm -rf "$FRONTEND_DIR"
  git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$FRONTEND_REF" "$FRONTEND_REPO" "$FRONTEND_DIR"
  echo "▸ Frontend $FRONTEND_REF at $(git -C "$FRONTEND_DIR" rev-parse --short HEAD)"
  echo "▸ Installing frontend dependencies…"
  ( cd "$FRONTEND_DIR" && npm ci )
else
  FRONTEND_DIR="${FRONTEND_DIR:-$HOME/flamingo/openframe-frontend}"
  if [ ! -d "$FRONTEND_DIR" ]; then
    echo "✗ FRONTEND_DIR not found: $FRONTEND_DIR" >&2
    echo "  Set FRONTEND_DIR to your openframe-frontend checkout, or FRONTEND_REF to a release tag." >&2
    exit 1
  fi
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
