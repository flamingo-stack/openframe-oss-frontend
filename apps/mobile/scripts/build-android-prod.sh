#!/usr/bin/env bash
# Production Google Play lane: build the prod web bundle and produce a SIGNED
# Android App Bundle (.aab) for Play Console. Unlike the stage/dev lanes this
# emits an AAB, not an APK — Play requires a bundle, and there is no App
# Distribution step.
#
# Usage:
#   NEXT_PUBLIC_SHARED_HOST_URL=https://auth.openframe.ai \
#   OF_UPLOAD_STORE_FILE=/abs/path/upload.jks OF_UPLOAD_STORE_PASSWORD=… \
#   OF_UPLOAD_KEY_ALIAS=upload OF_UPLOAD_KEY_PASSWORD=… \
#   [VERSION_CODE=7] [VERSION_NAME=1.0.1] scripts/build-android-prod.sh
#
# Required:  NEXT_PUBLIC_SHARED_HOST_URL — the PROD shared auth host.
#            OF_UPLOAD_* — the upload keystore (never committed; see
#                          android/app/src/README.md). Play rejects unsigned AABs.
# Optional:  SKIP_WEB=1     — reuse the already-staged www/ bundle.
#            WEB_ONLY=1     — stage web bundle + cap sync, then stop.
#            VERSION_CODE=n — overrides versionCode (Play requires it to increase
#                             per upload; build.gradle's default is 1).
#            VERSION_NAME=x — overrides versionName.
#            JBR=/path      — JDK home (default: Android Studio's bundled JBR).
#
# One-time prerequisites:
#   - Play Console app record for ai.openframe.mobile, Play App Signing enrolled.
#   - Upload keystore generated and its OF_UPLOAD_* values available here.
#   - PRODUCTION APNs/FCM setup on the prod Firebase project (firebase-94qh).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JBR="${JBR:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"  # CI passes its JDK
AAB="$HERE/android/app/build/outputs/bundle/prodRelease/app-prod-release.aab"

# Required even with SKIP_WEB=1: the native refresher bakes it into BuildConfig.
: "${NEXT_PUBLIC_SHARED_HOST_URL:?set NEXT_PUBLIC_SHARED_HOST_URL to the prod shared auth host}"
if [ "${SKIP_WEB:-0}" != "1" ]; then
  export NEXT_PUBLIC_APP_MODE="${NEXT_PUBLIC_APP_MODE:-saas-tenant}"
  # On Android the baked scheme MUST match the intent-filter scheme
  # (@string/custom_url_scheme), which prod leaves at the shared default.
  export NEXT_PUBLIC_MOBILE_APP_SCHEME="com.openframe.app"
  "$HERE/scripts/build-web.sh"
fi

if [ "${WEB_ONLY:-0}" = "1" ]; then
  echo "✓ Prod web bundle staged (WEB_ONLY). Local run: Android Studio → prodDebug variant."
  exit 0
fi

# build.gradle only *logs* when the keystore config is absent and leaves the
# release build unsigned. That is fine for local release smoke-tests but useless
# for Play, so fail early instead of at upload. The values may come from the
# environment OR from either gradle.properties (see android/app/src/README.md),
# so this is a presence check across all three, not an env-only one; the
# authoritative test is the signature check on the finished AAB below.
for v in OF_UPLOAD_STORE_FILE OF_UPLOAD_STORE_PASSWORD OF_UPLOAD_KEY_ALIAS OF_UPLOAD_KEY_PASSWORD; do
  if [ -n "${!v:-}" ]; then continue; fi
  if grep -qs "^\s*${v}\s*=" "$HERE/android/gradle.properties" "$HOME/.gradle/gradle.properties"; then continue; fi
  echo "✗ $v is set neither in the environment nor in android/gradle.properties or ~/.gradle/gradle.properties — the AAB would be unsigned and Play would reject it (see android/app/src/README.md)." >&2
  exit 1
done

if [ ! -f "$HERE/android/app/src/prod/google-services.json" ]; then
  echo "✗ android/app/src/prod/google-services.json is missing — supplied out-of-band (see android/app/src/README.md)." >&2
  exit 1
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

echo "▸ Building bundleProdRelease…"
( cd "$HERE/android" && JAVA_HOME="$JBR" ./gradlew bundleProdRelease \
    -PofSharedHostUrl="$NEXT_PUBLIC_SHARED_HOST_URL" \
    ${VERSION_CODE:+-PofVersionCode=$VERSION_CODE} \
    ${VERSION_NAME:+-PofVersionName=$VERSION_NAME} )

if [ ! -f "$AAB" ]; then
  echo "✗ expected AAB not found: $AAB" >&2
  exit 1
fi

# The real invariant: Gradle silently produces an unsigned bundle when the
# keystore config didn't resolve, whatever the pre-check thought.
if ! "$JBR/bin/jarsigner" -verify "$AAB" >/dev/null 2>&1; then
  echo "✗ $AAB is not signed — the OF_UPLOAD_* keystore config did not resolve (see android/app/src/README.md)." >&2
  exit 1
fi
echo "✓ signature verified"

echo "✓ AAB: $AAB"
echo "  Upload it in Play Console → Production (or a testing track) → Create release."
