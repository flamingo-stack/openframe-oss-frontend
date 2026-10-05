#!/usr/bin/env bash
# Stage TestFlight lane: build the stage web bundle, archive the "App Stage"
# scheme (bundle id ai.openframe.mobile.stage, scheme com.openframe.app.stage,
# stage Firebase config), and export an App Store Connect .ipa.
#
# Usage:
#   NEXT_PUBLIC_SHARED_HOST_URL=https://auth.stage.example \
#   [BUILD_NUMBER=42] [SKIP_WEB=1] scripts/build-ios-stage.sh
#
# Required:  NEXT_PUBLIC_SHARED_HOST_URL — the STAGE shared auth host. Baked
#                            into the web bundle AND Info.plist (native token
#                            refresher), so it is needed with SKIP_WEB=1 too.
# Optional:  BUILD_NUMBER  — CURRENT_PROJECT_VERSION for this archive
#                            (TestFlight requires it to increase per upload).
#            SKIP_WEB=1    — reuse the already-staged www/ bundle (must have
#                            been built by this lane, or the env baked into it
#                            won't match the stage app).
#            WEB_ONLY=1    — stage the stage web bundle + cap sync, then stop
#                            (local testing: open Xcode, run the "App Stage"
#                            scheme on a device/simulator).
#
# Manual prerequisites (one-time, outside this script):
#   - App Store Connect app record for ai.openframe.mobile.stage (TestFlight-only).
#   - App ID ai.openframe.mobile.stage registered with Push capability
#     (automatic signing can register it on first archive from Xcode).
#   - APNs .p8 uploaded to the STAGE Firebase iOS app.
#   - Xcode signed into the team (F7LDSU8JPJ) for -allowProvisioningUpdates.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$HERE/build/OpenFrame-stage.xcarchive"
EXPORT_DIR="$HERE/build/stage"

# Required even with SKIP_WEB=1: the archive bakes it into Info.plist
# (OpenFrameSharedHostURL) for the native token refresher, from the same
# variable the web bundle bakes, so the two cannot drift.
: "${NEXT_PUBLIC_SHARED_HOST_URL:?set NEXT_PUBLIC_SHARED_HOST_URL to the stage shared auth host}"

if [ "${SKIP_WEB:-0}" != "1" ]; then
  # Stage identity: saas-tenant mode + the stage callback scheme (must match
  # the Debug-stage/Release-stage OPENFRAME_URL_SCHEME build setting).
  export NEXT_PUBLIC_APP_MODE="${NEXT_PUBLIC_APP_MODE:-saas-tenant}"
  export NEXT_PUBLIC_MOBILE_APP_SCHEME="com.openframe.app"
  "$HERE/scripts/build-web.sh"
fi

if [ "${WEB_ONLY:-0}" = "1" ]; then
  echo "✓ Stage web bundle staged (WEB_ONLY). Test locally: npx cap open ios → scheme \"App Stage\" → Run."
  exit 0
fi

# A live-reload server.url must never ship — it would point the app at a dev
# box. Strip comment-only lines and block comments first: the config keeps a
# commented-out live-reload example, which must not trip the guard.
if ! node -e "
const c = require('fs').readFileSync(process.argv[1], 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*\$/gm, '');
process.exit(/server\s*:\s*\{[^}]*url\s*:/.test(c) ? 1 : 0);
" "$HERE/capacitor.config.ts"; then
  echo "✗ capacitor.config.ts contains a live-reload server.url — remove it before a shippable build." >&2
  exit 1
fi

echo "▸ Archiving App Stage (Release-stage)…"
xcodebuild archive \
  -project "$HERE/ios/App/App.xcodeproj" \
  -scheme "App Stage" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  OPENFRAME_SHARED_HOST_URL="$NEXT_PUBLIC_SHARED_HOST_URL" \
  ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION=$BUILD_NUMBER}

echo "▸ Exporting .ipa for App Store Connect…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$HERE/ios/App/exportOptions-appstore.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

echo "✓ Exported: $EXPORT_DIR"
echo "  Upload to TestFlight with the Transporter app, or:"
echo "  xcrun altool --upload-app -f \"$EXPORT_DIR\"/*.ipa -t ios --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>"
