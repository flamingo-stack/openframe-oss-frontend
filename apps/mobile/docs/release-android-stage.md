# Android stage release (Firebase App Distribution)

Stage installs side by side with prod: `ai.openframe.mobile.stage`, launcher
label **"OF Stage"** (per-flavor `strings.xml` override — the launcher shows the
*activity* label, so `title_activity_main` is overridden along with `app_name`).
The OAuth scheme is still the shared `com.openframe.app` — with prod installed,
the Custom-Tabs login redirect shows an **app chooser**; testers pick "OF Stage".
(Per-flavor schemes are blocked on gateway support; frontend plumbing exists —
`NEXT_PUBLIC_MOBILE_APP_SCHEME`.)

## Build + distribute

```sh
NEXT_PUBLIC_SHARED_HOST_URL=https://<stage shared auth host> \
RELEASE_NOTES="what changed" \
scripts/build-android-stage.sh
```

Web bundle (stage env baked) → `cap sync` → `assembleStageDebug` →
`firebase appdistribution:distribute` to the `qa` group. The Firebase app id is
read from `android/app/src/stage/google-services.json` automatically.

Flags: `SKIP_WEB=1` (reuse staged bundle), `WEB_ONLY=1` (stop after sync — then
test via Android Studio, Build Variants → `stageDebug`), `SKIP_DISTRIBUTE=1`
(build only), `RELEASE=1` (`assembleStageRelease`; needs the `OF_UPLOAD_*`
keystore or App Distribution rejects the unsigned APK), `TESTER_GROUP=<name>`.

## One-time setup

1. Firebase console → **stage** project → App Distribution → Get started for
   the `ai.openframe.mobile.stage` Android app; create the `qa` tester group
   and invite emails (testers sign in with a Google account matching the invite).
2. On the build Mac: `npm i -g firebase-tools && firebase login`.

## Tester flow

Invite email → open on the phone → sign in → download the APK (one-time
"install unknown apps" permission for the browser) or use the App Tester app.
Debug APKs are fine for App Distribution; no store review, no versionCode
gatekeeping (bump it for readability, not necessity).

## Gotchas

- Login with prod installed → scheme chooser (above). Picking the wrong app
  strands the ticket — cancel and retry, choosing "OF Stage".
- Fingerprint login: device-only to verify, and the `bio.v2` Keystore alias
  gotcha means devices that enabled biometrics on older test builds need a
  clean reinstall (see CLAUDE.md).
- Push: test from the **stage** Firebase console — FCM is direct on Android,
  no APNs step.
