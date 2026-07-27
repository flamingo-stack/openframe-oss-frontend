# openframe-mobile

Native **iOS + Android** shell for OpenFrame, built with **Capacitor 8**. It wraps the
**existing `openframe-frontend` static export** — there is **no UI code in this repo**.
The same frontend bundle that runs on the web and desktop runs here; this project adds
the native container plus the native glue the web build can't provide: system-browser
OAuth, Keychain/Keystore token storage with biometric unlock, push, and native chrome.

Strategy & rationale: `openframe-desktop/docs/mobile-app-plan.md` and
`…/native-apps-strategy.md`. Frontend static-export work: the frontend repo's
`docs/static-export-migration.md`.

## Layout

```
capacitor.config.ts     # appId / appName / webDir / plugin config (+ optional dev server.url)
www/                     # the staged web bundle (git-ignored build artifact)
ios/                     # Xcode project (Swift Package Manager, no CocoaPods)
android/                 # Gradle project (prod/stage/dev product flavors)
assets/                  # icon + splash vector sources for @capacitor/assets
dev/push-sample.apns     # sample payload for `npm run push:demo`
scripts/
  make-placeholder-web.mjs   # writes a dev stub into www/ (no frontend build needed)
  build-web.sh               # build openframe-frontend export → www/ + inject env + sync
  inject-env.mjs             # prepend window.__ENV so the bundle resolves its tenant host
  build-ios-{stage,dev}.sh       # archive + export a TestFlight .ipa
  build-android-{stage,dev}.sh   # assemble the flavor APK + Firebase App Distribution
docs/project-structure.md      # how it all fits: bundling, Capacitor code, what's generated
docs/using-native-apis.md      # calling native APIs from TS (worked push example)
docs/run-on-iphone.md          # run a dev build on a physical iPhone / simulator
docs/release-ios-stage.md      # stage TestFlight lane + one-time ASC/APNs setup
docs/release-android-stage.md  # stage App Distribution lane + one-time setup
```

How the frontend is bundled, where the Capacitor code lives, and exactly what each
platform build generates: **[docs/project-structure.md](docs/project-structure.md)**.

## Quickstart

```bash
npm install
npm run web:placeholder      # or: npm run build:web   (real frontend export)
npx cap sync ios
npx cap open ios             # → Xcode: set signing Team, pick your iPhone, Run
```

Android (builds with Android Studio's bundled JBR — no system Java needed):

```bash
cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew assembleDevDebug          # or open android/ in Android Studio
```

Full device guide incl. signing, Developer Mode, and a live-reload loop:
**[docs/run-on-iphone.md](docs/run-on-iphone.md)**.

## How the bundle gets here

`www/` is a build artifact, not source. A fresh clone must stage a bundle before either
platform will build. Either use the dev stub (`npm run web:placeholder`) or build the
real export:

```bash
NEXT_PUBLIC_SHARED_HOST_URL=https://<auth-host> \
NEXT_PUBLIC_APP_MODE=saas-tenant \
  npm run build:web
```

One binary serves all tenants: the shell discovers the tenant at login (email →
`/sas/tenant/discover` on the shared host) and learns/persists the tenant host from
the OAuth callback. To pin a single tenant instead (dev/self-hosted), add
`NEXT_PUBLIC_TENANT_HOST_URL=https://<tenant>`. Frontend checkout defaults to
`~/flamingo/openframe-frontend`; override with `FRONTEND_DIR`.

`build:web` runs `OPENFRAME_BUILD_TARGET=export npm run build` in the frontend, copies
its `dist/` into `www/`, injects `window.__ENV`, and runs `cap sync`. **Env vars are
baked at build time** — re-run the build when any of them change.

## Environments

Three app identities install side by side, so a tester can hold prod, stage, and dev at
once:

| | prod | stage | dev |
|---|---|---|---|
| bundle id / applicationId | `ai.openframe.mobile` | `…​.stage` | `…​.dev` |
| launcher name | OpenFrame | OF Stage | OF Dev |
| iOS | `App` scheme, Debug/Release | `App Stage`, `Debug-stage`/`Release-stage` | `App Dev`, `Debug-dev`/`Release-dev` |
| Android | `prodDebug`/`prodRelease` | `stageDebug`/… | `devDebug`/… |

Release lanes build the matching web bundle, then ship:

```bash
NEXT_PUBLIC_SHARED_HOST_URL=https://<stage auth host> BUILD_NUMBER=<n> \
  scripts/build-ios-stage.sh          # → build/stage/*.ipa for TestFlight

NEXT_PUBLIC_SHARED_HOST_URL=https://<stage auth host> RELEASE_NOTES="what changed" \
  scripts/build-android-stage.sh      # → Firebase App Distribution (qa group)
```

`WEB_ONLY=1` stops after staging the bundle (then run from Xcode/Android Studio);
`SKIP_WEB=1` reuses the staged bundle; `SKIP_DISTRIBUTE=1` builds the APK without
uploading. Details and one-time setup: **[docs/release-ios-stage.md](docs/release-ios-stage.md)**,
**[docs/release-android-stage.md](docs/release-android-stage.md)**.

## Firebase config (required, not in the repo)

Every `google-services.json` / `GoogleService-Info.plist` is **git-ignored** and supplied
out-of-band — see `android/app/src/README.md`. A missing file fails the build (the iOS
"Select Firebase config" phase and Gradle's `processGoogleServices` both hard-error).

```
android/app/src/{prod,stage,dev}/google-services.json
ios/App/App/GoogleService-Info.plist              # prod
ios/App/App/GoogleServices/{stage,dev}/GoogleService-Info.plist
```

Push additionally needs the APNs `.p8` uploaded to each Firebase iOS app and the Push
capability on the App ID.

## Notes

- **Capacitor 8 → Swift Package Manager.** No CocoaPods. Open `ios/App/App.xcodeproj`
  directly; Xcode resolves the Capacitor packages.
- **Push notifications are wired**: all-FCM via `@capacitor-firebase/messaging` (FCM
  brokers APNs) + `aps-environment` entitlement + remote-notification background mode.
  Foreground banners are suppressed on both platforms; the JS side lives in the frontend
  (`src/lib/native-push.ts`, post-login). Device builds need a **paid** Apple team
  (free provisioning rejects the push entitlement); simulator builds are unaffected.
- **Auth + biometrics are custom native code**, not plugins — `NativeAuthPlugin`
  (Swift/Java) does system-browser login, dev-ticket exchange, and one-item
  Keychain/Keystore token storage with an optional biometric gate. See CLAUDE.md.
- **Generated files** — `capacitor.config.json`, `config.xml`, `CapApp-SPM/Package.swift`
  are produced by `cap sync`; edit `capacitor.config.ts` instead.
- A live-reload `server.url` in `capacitor.config.ts` must be removed before any
  shippable build — the release lanes hard-fail if one is present.
- Other native plugins (camera, barcode scanning) are intentionally not installed yet —
  see mobile-app-plan.md §6.
