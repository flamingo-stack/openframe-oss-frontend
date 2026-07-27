#!/usr/bin/env bash
# Production App Store lane: build the prod web bundle, archive the "App" scheme
# in Release (bundle id ai.openframe.mobile, scheme com.openframe.app, root
# GoogleService-Info.plist), and export an App Store Connect .ipa.
#
# Usage:
#   NEXT_PUBLIC_SHARED_HOST_URL=https://auth.openframe.ai \
#   [BUILD_NUMBER=7] [SKIP_WEB=1] scripts/build-ios-prod.sh
#
# Required:  NEXT_PUBLIC_SHARED_HOST_URL — the PROD shared auth host.
# Optional:  BUILD_NUMBER  — CURRENT_PROJECT_VERSION for this archive (App Store
#                            Connect requires it to increase per upload).
#            SKIP_WEB=1    — reuse the already-staged www/ bundle (must have been
#                            built by this lane, or the baked env won't match).
#            WEB_ONLY=1    — stage the prod web bundle + cap sync, then stop.
#
# Manual prerequisites (one-time, outside this script):
#   - App Store Connect app record for ai.openframe.mobile.
#   - App ID ai.openframe.mobile with the Push Notifications capability.
#   - PRODUCTION APNs .p8 uploaded to the prod Firebase iOS app (firebase-94qh).
#   - Xcode signed into the team (F7LDSU8JPJ) for -allowProvisioningUpdates.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$HERE/build/OpenFrame-prod.xcarchive"
EXPORT_DIR="$HERE/build/prod"

if [ "${SKIP_WEB:-0}" != "1" ]; then
  : "${NEXT_PUBLIC_SHARED_HOST_URL:?set NEXT_PUBLIC_SHARED_HOST_URL to the prod shared auth host}"
  # Prod identity: saas-tenant mode + the prod callback scheme (matches the
  # Release configuration's OPENFRAME_URL_SCHEME build setting).
  export NEXT_PUBLIC_APP_MODE="${NEXT_PUBLIC_APP_MODE:-saas-tenant}"
  export NEXT_PUBLIC_MOBILE_APP_SCHEME="com.openframe.app"
  "$HERE/scripts/build-web.sh"
fi

if [ "${WEB_ONLY:-0}" = "1" ]; then
  echo "✓ Prod web bundle staged (WEB_ONLY). Test locally: npx cap open ios → scheme \"App\" → Run."
  exit 0
fi

# The prod Firebase config is the committed-path root plist (the "Select Firebase
# config" build phase only swaps for *-stage / *-dev configurations), so an
# absent file would ship a push-less binary that still archives cleanly.
if [ ! -f "$HERE/ios/App/App/GoogleService-Info.plist" ]; then
  echo "✗ ios/App/App/GoogleService-Info.plist is missing — the prod Firebase config is supplied out-of-band (see android/app/src/README.md)." >&2
  exit 1
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

echo "▸ Archiving App (Release)…"
xcodebuild archive \
  -project "$HERE/ios/App/App.xcodeproj" \
  -scheme "App" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION=$BUILD_NUMBER}

# aps-environment comes from the APS_ENVIRONMENT build setting (production in
# Release*). A `development` value here means push silently dies in the App
# Store build — cheaper to catch now than after a review cycle.
APS="$(codesign -d --entitlements - --xml "$ARCHIVE/Products/Applications/App.app" 2>/dev/null \
  | plutil -extract aps-environment raw -o - - 2>/dev/null || true)"
if [ "$APS" != "production" ]; then
  echo "✗ archive has aps-environment='${APS:-<none>}', expected 'production' — push would not work in the shipped build." >&2
  exit 1
fi
echo "✓ aps-environment: production"

echo "▸ Exporting .ipa for App Store Connect…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$HERE/ios/App/exportOptions-appstore.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

echo "✓ Exported: $EXPORT_DIR"
echo "  Upload with the Transporter app, or:"
echo "  xcrun altool --upload-app -f \"$EXPORT_DIR\"/*.ipa -t ios --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>"
