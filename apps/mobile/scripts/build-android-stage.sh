#!/usr/bin/env bash
# Stage Android lane: build the stage web bundle, assemble the stage APK, and
# push it to Firebase App Distribution (tester group). Mirrors build-ios-stage.sh.
#
# Usage:
#   NEXT_PUBLIC_SHARED_HOST_URL=https://auth.stage.example \
#   [RELEASE_NOTES="fixed login"] scripts/build-android-stage.sh
#
# Required:  NEXT_PUBLIC_SHARED_HOST_URL — the STAGE shared auth host.
# Optional:  SKIP_WEB=1         — reuse the already-staged www/ bundle.
#            WEB_ONLY=1         — stage web bundle + cap sync, then stop.
#            SKIP_DISTRIBUTE=1  — build the APK, skip the App Distribution upload.
#            RELEASE=1          — assembleStageRelease instead of Debug (needs the
#                                 OF_UPLOAD_* keystore config, else the APK is
#                                 unsigned and App Distribution rejects it).
#            TESTER_GROUP=qa    — App Distribution group (default: qa).
#            RELEASE_NOTES=...  — shown to testers in the invite/App Tester.
#
# One-time prerequisites:
#   - Firebase console (STAGE project): App Distribution enabled for the
#     ai.openframe.mobile.stage Android app; tester group created.
#   - npm i -g firebase-tools && firebase login (on this machine).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# Required even with SKIP_WEB=1: the native refresher bakes it into BuildConfig.
: "${NEXT_PUBLIC_SHARED_HOST_URL:?set NEXT_PUBLIC_SHARED_HOST_URL to the stage shared auth host}"
if [ "${SKIP_WEB:-0}" != "1" ]; then
  export NEXT_PUBLIC_APP_MODE="${NEXT_PUBLIC_APP_MODE:-saas-tenant}"
  # Scheme stays the shared default (com.openframe.app) until the gateway
  # accepts per-env schemes — on Android this means an app CHOOSER appears at
  # login when prod is installed alongside; testers pick "OF Stage".
  "$HERE/scripts/build-web.sh"
fi

if [ "${WEB_ONLY:-0}" = "1" ]; then
  echo "✓ Stage web bundle staged (WEB_ONLY). Local run: Android Studio → stageDebug variant."
  exit 0
fi

# A live-reload server.url must never ship — it would point the app at a dev
# box. Comment-only lines are stripped (the config keeps a commented example).
if ! node -e "
const c = require('fs').readFileSync(process.argv[1], 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*\$/gm, '');
process.exit(/server\s*:\s*\{[^}]*url\s*:/.test(c) ? 1 : 0);
" "$HERE/capacitor.config.ts"; then
  echo "✗ capacitor.config.ts contains a live-reload server.url — remove it before a shippable build." >&2
  exit 1
fi

if [ "${RELEASE:-0}" = "1" ]; then
  VARIANT_TASK=assembleStageRelease
  APK="$HERE/android/app/build/outputs/apk/stage/release/app-stage-release.apk"
else
  VARIANT_TASK=assembleStageDebug
  APK="$HERE/android/app/build/outputs/apk/stage/debug/app-stage-debug.apk"
fi

echo "▸ Building ${VARIANT_TASK}…"
( cd "$HERE/android" && JAVA_HOME="$JBR" ./gradlew "$VARIANT_TASK" \
    -PofSharedHostUrl="$NEXT_PUBLIC_SHARED_HOST_URL" )

if [ ! -f "$APK" ]; then
  echo "✗ expected APK not found: $APK" >&2
  exit 1
fi
echo "✓ APK: $APK"

if [ "${SKIP_DISTRIBUTE:-0}" = "1" ]; then
  echo "✓ SKIP_DISTRIBUTE — done."
  exit 0
fi

command -v firebase >/dev/null || {
  echo "✗ firebase CLI not found — npm i -g firebase-tools && firebase login" >&2
  exit 1
}

# The Firebase Android app id lives in the stage google-services.json
# (mobilesdk_app_id) — self-configure instead of hardcoding it.
FIREBASE_APP_ID="$(node -e "
const j = require(process.argv[1]);
const c = j.client.find(c => c.client_info?.android_client_info?.package_name === 'ai.openframe.mobile.stage');
if (!c) { console.error('no ai.openframe.mobile.stage client in google-services.json'); process.exit(1); }
console.log(c.client_info.mobilesdk_app_id);
" "$HERE/android/app/src/stage/google-services.json")"

echo "▸ Distributing to Firebase App Distribution (group: ${TESTER_GROUP:-qa})…"
firebase appdistribution:distribute "$APK" \
  --app "$FIREBASE_APP_ID" \
  --groups "${TESTER_GROUP:-qa}" \
  ${RELEASE_NOTES:+--release-notes "$RELEASE_NOTES"}

echo "✓ Distributed. Testers are notified by email / App Tester."
