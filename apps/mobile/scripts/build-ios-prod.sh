#!/usr/bin/env bash
# Production App Store lane: build the prod web bundle, archive the "App" scheme
# in Release (bundle id ai.openframe.mobile, scheme com.openframe.app, root
# GoogleService-Info.plist), and export an App Store Connect .ipa.
#
# Usage:
#   NEXT_PUBLIC_SHARED_HOST_URL=https://auth.openframe.ai \
#   [BUILD_NUMBER=7] [SKIP_WEB=1] scripts/build-ios-prod.sh
#
# Required:  NEXT_PUBLIC_SHARED_HOST_URL — the PROD shared auth host. Baked
#                            into the web bundle AND Info.plist (native token
#                            refresher), so it is needed with SKIP_WEB=1 too.
# Optional:  BUILD_NUMBER  — CURRENT_PROJECT_VERSION for this archive (App Store
#                            Connect requires it to increase per upload).
#            SKIP_WEB=1    — reuse the already-staged www/ bundle (must have been
#                            built by this lane, or the baked env won't match).
#            WEB_ONLY=1    — stage the prod web bundle + cap sync, then stop.
#            VERSION_NAME=x — MARKETING_VERSION for this archive.
#            ASC_KEY_PATH  — App Store Connect API key (.p8, Admin role) with
#                            ASC_KEY_ID + ASC_ISSUER_ID: signs without an Xcode
#                            account (CI).
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

# Required even with SKIP_WEB=1: the archive bakes it into Info.plist
# (OpenFrameSharedHostURL) for the native token refresher, from the same
# variable the web bundle bakes, so the two cannot drift.
: "${NEXT_PUBLIC_SHARED_HOST_URL:?set NEXT_PUBLIC_SHARED_HOST_URL to the prod shared auth host}"

if [ "${SKIP_WEB:-0}" != "1" ]; then
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
  OPENFRAME_SHARED_HOST_URL="$NEXT_PUBLIC_SHARED_HOST_URL" \
  ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION=$BUILD_NUMBER} \
  ${VERSION_NAME:+MARKETING_VERSION=$VERSION_NAME} \
  ${ASC_KEY_PATH:+-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID"}

echo "▸ Exporting .ipa for App Store Connect…"
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$HERE/ios/App/exportOptions-appstore.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates \
  ${ASC_KEY_PATH:+-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID"}

# aps-environment must be checked on the EXPORTED ipa, not the archive: with
# cloud-managed automatic signing the archive is signed with the local Apple
# Development identity (aps-environment=development, get-task-allow=true) and
# only -exportArchive re-signs it with the Apple Distribution cert + App Store
# profile. A `development` value here would ship a binary whose push silently
# dies — cheaper to catch now than after a review cycle.
IPA="$(basename "$(ls "$EXPORT_DIR"/*.ipa)")"
APS="$(/usr/libexec/PlistBuddy -c "Print :${IPA}:0:entitlements:aps-environment" \
  "$EXPORT_DIR/DistributionSummary.plist" 2>/dev/null || true)"
if [ "$APS" != "production" ]; then
  echo "✗ $IPA has aps-environment='${APS:-<none>}', expected 'production' — push would not work in the shipped build. Do not upload it." >&2
  exit 1
fi
echo "✓ aps-environment: production"

echo "✓ Exported: $EXPORT_DIR"
echo "  Upload with the Transporter app, or:"
echo "  xcrun altool --upload-app -f \"$EXPORT_DIR\"/*.ipa -t ios --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>"
