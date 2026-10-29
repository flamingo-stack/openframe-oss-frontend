#!/usr/bin/env bash
# Upload an archive's dSYMs to Sentry so native crashes symbolicate. A no-op
# without SENTRY_AUTH_TOKEN; SENTRY_ORG and SENTRY_PROJECT name the target.
# Usage: scripts/upload-dsyms.sh <path/to.xcarchive>
set -euo pipefail

[ -n "${SENTRY_AUTH_TOKEN:-}" ] || exit 0
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$HERE/../web/node_modules/@sentry/cli/bin/sentry-cli"
[ -f "$CLI" ] || ( cd "$HERE/../web" && npm ci )

echo "▸ Uploading dSYMs to Sentry…"
node "$CLI" debug-files upload "$1/dSYMs"
