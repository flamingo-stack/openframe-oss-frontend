# Android production release (Google Play)

Prod is the `prod` flavor in `release`: `ai.openframe.mobile`, launcher label
**"OpenFrame"**, OAuth scheme `com.openframe.app`, Firebase project
`firebase-94qh` via `android/app/src/prod/google-services.json`.

Unlike the stage/dev lanes this produces a **signed Android App Bundle**, not an
APK — Play requires an AAB for new apps and rejects unsigned uploads.

## Build

```sh
NEXT_PUBLIC_SHARED_HOST_URL=https://<prod shared auth host> \
OF_UPLOAD_STORE_FILE=$HOME/keys/openframe-upload.jks \
OF_UPLOAD_STORE_PASSWORD=… OF_UPLOAD_KEY_ALIAS=upload OF_UPLOAD_KEY_PASSWORD=… \
VERSION_CODE=<increasing int> VERSION_NAME=1.0.1 \
scripts/build-android-prod.sh
```

Web bundle (prod env baked) → `cap sync` → `bundleProdRelease` →
`android/app/build/outputs/bundle/prodRelease/app-prod-release.aab`. Upload it
in Play Console → the target track → Create release.

The `OF_UPLOAD_*` values may equally live in `android/gradle.properties` or
`~/.gradle/gradle.properties` (see `android/app/src/README.md`); the lane checks
all three, and then verifies the finished AAB is actually signed — Gradle
otherwise emits an unsigned bundle with nothing but a log line.

`VERSION_CODE` / `VERSION_NAME` map to `-PofVersionCode` / `-PofVersionName`, so
bumping a release needs no commit. Without them the `build.gradle` defaults
(`1` / `1.0`) apply.

Flags: `SKIP_WEB=1`, `WEB_ONLY=1` (stop after sync — then Android Studio, Build
Variants → `prodDebug`).

## One-time setup

1. **Upload keystore** — generate once, never commit, and back it up:
   ```sh
   keytool -genkeypair -v -keystore openframe-upload.jks -alias upload \
     -keyalg RSA -keysize 4096 -validity 10000
   ```
   Losing it means asking Play to reset the upload key; losing it *before*
   enrolling in Play App Signing means losing the app identity entirely.
2. **Play Console app record** for `ai.openframe.mobile`, enrolled in **Play App
   Signing** (Play holds the app signing key; your `.jks` is only the *upload*
   key).
3. **Prod Firebase** — `android/app/src/prod/google-services.json` in place.
   Map it by **package_name**, never by folder name. FCM is direct on Android;
   no APNs step.
4. **Gateway** — same `capacitor://localhost` CORS + `/content/*` exposure and
   `redirectTo=com.openframe.app://auth` allowlisting as iOS.

## Submission checklist (Play Console)

- **Data safety form** — must agree with the privacy policy and with
  `ios/App/App/PrivacyInfo.xcprivacy` (currently: email address, name, user ID;
  linked, not used for tracking). Declare the FCM token separately if Play's
  taxonomy asks for device identifiers.
- **Privacy policy URL** — required.
- **Account deletion URL** — required for any app that supports account
  creation, and it must be reachable on the web without installing the app, in
  addition to the in-app deletion path.
- **App access** — reviewer login instructions plus a demo account on a tenant
  with an **active plan**, and a second disposable account for the deletion
  test.
- **Content rating** questionnaire, **target audience**, **ads** declaration.
- **Closed testing prerequisite** — if the Play developer account is a
  *personal* one created after Nov 2023, production access requires 12 testers
  opted in for 14 continuous days first. Organization accounts are exempt.
  Check which type the account is before planning the timeline.

## Blocking on the frontend, not here

Same list as iOS: account deletion (in-app **and** the public URL above), and
removing every purchase path from the mobile build. Play is less strict than
Apple about the sign-in provider, but the deletion policy is enforced on the
Data safety declaration. Full analysis: vault note
`Releases/Mobile App - Store Review Readiness Plan`.

## Gotchas

- `versionCode` must strictly increase per upload and can never be reused, even
  for a discarded release. `versionName` is cosmetic.
- Backup is off deliberately: `allowBackup="false"` **plus**
  `res/xml/data_extraction_rules.xml`, because on Android 12+ the manifest flag
  alone doesn't stop device-to-device transfer, and `SecureTokenStore`'s blob is
  wrapped by a device-bound Keystore key — a transferred copy can never be
  decrypted and strands the user in a broken auth state.
- `minifyEnabled false` is intentional. Turning R8 on risks stripping the
  reflection Capacitor uses for plugin registration; it buys nothing for review.
- **Predictive back is fine** — verified 2026-07-27 on a Galaxy Z Flip 7
  (Android 16 / API 36, gesture navigation): both `KEYCODE_BACK` and the
  left-edge swipe reach the JS `backButton` listener. `@capacitor/app` registers
  an `OnBackPressedCallback` on `getOnBackPressedDispatcher()` and
  `androidx.activity` 1.11 bridges that to the platform
  `OnBackInvokedDispatcher`, so targeting SDK 36 changes nothing — there is no
  legacy `onBackPressed` override anywhere in the stack. Don't "fix" this by
  adding `enableOnBackInvokedCallback`. Still unverified: the *navigate* branch
  of `native-back.ts` (close overlay → `history.back()`), which needs a
  logged-in session — every observed back reported `canGoBack=false` on `/auth/`
  and correctly exited via `App.exitApp()`.
- Fingerprint login is device-only to verify, and the `bio.v2` Keystore alias
  change means test devices that enabled biometrics on older builds need a
  clean reinstall (see CLAUDE.md).
