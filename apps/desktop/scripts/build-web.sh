#!/usr/bin/env bash
# Build the web app's STATIC EXPORT from this repository and stage it as the
# Tauri web bundle (www/). The shell holds no UI code — it embeds that export,
# always from the same commit as the shell itself.
#
# No inject-env.mjs step, unlike apps/mobile/scripts/build-web.sh: the desktop
# shell injects window.__ENV at RUNTIME (see src-tauri/src/lib.rs
# env_init_script), so nothing is baked into the HTML here.
#
# The shell's one configured URL is the shared auth host, and it comes from the
# Rust build rather than this script:
#   make build OPENFRAME_SHARED_HOST_URL=https://auth.openframe.example
# (per-install override: "shared_host" in the app's config.json). The tenant is
# never configured — the bundle's /auth pages discover it from the user's email,
# and login learns the tenant origin from the OAuth callback.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$(cd "$HERE/../.." && pwd)"

if [ ! -d "$WEB_DIR/node_modules" ]; then
  echo "▸ Installing web dependencies…"
  ( cd "$WEB_DIR" && npm ci )
fi

echo "▸ Building static export ($WEB_DIR)…"
( cd "$WEB_DIR" && OPENFRAME_BUILD_TARGET="export" npm run build )

if [ ! -d "$WEB_DIR/dist" ]; then
  echo "✗ export produced no dist/ in $WEB_DIR" >&2
  exit 1
fi

echo "▸ Staging export bundle → www/"
rm -rf "$HERE/www"
cp -R "$WEB_DIR/dist" "$HERE/www"

echo "✓ web bundle staged. Next: npm run dev (or make build)"
