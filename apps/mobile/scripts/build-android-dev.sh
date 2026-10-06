#!/usr/bin/env bash
# Dev Android lane: build the dev web bundle, assemble the dev APK
# (ai.openframe.mobile.dev, "OF Dev", dev Firebase config from
# android/app/src/dev/google-services.json), and push it to Firebase App
# Distribution. Mirrors build-android-stage.sh.
#
# Usage:
#   NEXT_PUBLIC_SHARED_HOST_URL=https://openframe.build \
#   [RELEASE_NOTES="fixed login"] scripts/build-android-dev.sh
#
# Required:  NEXT_PUBLIC_SHARED_HOST_URL — the DEV shared auth host.
# Optional:  SKIP_WEB=1         — reuse the already-staged www/ bundle (must have
#                                 been built for dev, or the baked env won't match).
#            WEB_ONLY=1         — stage web bundle + cap sync, then stop.
#            SKIP_DISTRIBUTE=1  — build the APK, skip the App Distribution upload.
#            RELEASE=1          — assembleDevRelease instead of Debug (needs the
#                                 ANDROID_UPLOAD_* keystore config, else the APK is
#                                 unsigned and App Distribution rejects it).
#            TESTER_GROUP=qa    — App Distribution group (default: qa).
#            RELEASE_NOTES=...  — shown to testers in the invite/App Tester.
#
# One-time prerequisites:
#   - Firebase console (DEV project, firebase-nwp3): App Distribution enabled
#     for the ai.openframe.mobile.dev Android app; tester group created.
#   - npm i -g firebase-tools && firebase login (on this machine).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

# The per-env Firebase config is gitignored (supplied out-of-band) — fail before
# Gradle does, with a pointer instead of a processDevDebugGoogleServices error.
GOOGLE_SERVICES="$HERE/android/app/src/dev/google-services.json"
if [ ! -f "$GOOGLE_SERVICES" ]; then
  echo "✗ missing $GOOGLE_SERVICES — supply the DEV Firebase config (see android/app/src/README.md)." >&2
  exit 1
fi

# Required even with SKIP_WEB=1: the native refresher bakes it into BuildConfig.
: "${NEXT_PUBLIC_SHARED_HOST_URL:?set NEXT_PUBLIC_SHARED_HOST_URL to the dev shared auth host}"
if [ "${SKIP_WEB:-0}" != "1" ]; then
  export NEXT_PUBLIC_APP_MODE="${NEXT_PUBLIC_APP_MODE:-saas-tenant}"
  # Dev is the one lane that opts into the dev-ticket observer (default is off).
  export NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER="${NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER:-true}"
  # Scheme stays the shared default (com.openframe.app) — all Android flavors
  # share the custom_url_scheme intent-filter until the gateway accepts per-env
  # schemes, so a login with prod/stage installed alongside shows an app
  # CHOOSER; testers pick "OF Dev".
  "$HERE/scripts/build-web.sh"
fi

if [ "${WEB_ONLY:-0}" = "1" ]; then
  echo "✓ Dev web bundle staged (WEB_ONLY). Local run: Android Studio → devDebug variant."
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
  VARIANT_TASK=assembleDevRelease
  APK="$HERE/android/app/build/outputs/apk/dev/release/app-dev-release.apk"
else
  VARIANT_TASK=assembleDevDebug
  APK="$HERE/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk"
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

# The Firebase Android app id lives in the dev google-services.json
# (mobilesdk_app_id) — self-configure instead of hardcoding it.
FIREBASE_APP_ID="$(node -e "
const j = require(process.argv[1]);
const c = j.client.find(c => c.client_info?.android_client_info?.package_name === 'ai.openframe.mobile.dev');
if (!c) { console.error('no ai.openframe.mobile.dev client in google-services.json'); process.exit(1); }
console.log(c.client_info.mobilesdk_app_id);
" "$GOOGLE_SERVICES")"

echo "▸ Distributing to Firebase App Distribution (group: ${TESTER_GROUP:-qa})…"
firebase appdistribution:distribute "$APK" \
  --app "$FIREBASE_APP_ID" \
  --groups "${TESTER_GROUP:-qa}" \
  ${RELEASE_NOTES:+--release-notes "$RELEASE_NOTES"}

echo "✓ Distributed. Testers are notified by email / App Tester."
