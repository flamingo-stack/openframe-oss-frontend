# openframe-mobile

Native **iOS + Android** shell for OpenFrame, built with **Capacitor 8**. It wraps the
**existing `openframe-frontend` static export** — there is **no UI code in this repo**.
The same frontend bundle that runs on the web and desktop runs here; this project only
adds the native container and (later) native-feature glue (push, biometrics, camera).

Strategy & rationale: `openframe-desktop/docs/mobile-app-plan.md` and
`…/native-apps-strategy.md`. Frontend static-export work: the frontend repo's
`docs/static-export-migration.md`.

## Layout

```
capacitor.config.ts     # appId / appName / webDir (+ optional dev server.url)
www/                     # the staged web bundle (git-ignored build artifact)
ios/                     # generated Xcode project (Swift Package Manager, no CocoaPods)
scripts/
  make-placeholder-web.mjs   # writes a dev stub into www/ (no frontend build needed)
  build-web.sh               # build openframe-frontend export → www/ + inject env + sync
  inject-env.mjs             # prepend window.__ENV so the bundle resolves its tenant host
docs/project-structure.md # how it all fits: bundling, Capacitor code, what's generated
docs/using-native-apis.md # calling native APIs from TS (worked push example)
docs/run-on-iphone.md    # run a dev build on a physical iPhone / simulator
```

How the frontend is bundled, where the Capacitor code lives, and exactly what each
platform build generates: **[docs/project-structure.md](docs/project-structure.md)**.

## Quickstart (iOS)

```bash
npm install
npm run web:placeholder      # or: npm run build:web   (real frontend export)
npx cap sync ios
npx cap open ios             # → Xcode: set signing Team, pick your iPhone, Run
```

Full device guide incl. signing, Developer Mode, and a live-reload loop:
**[docs/run-on-iphone.md](docs/run-on-iphone.md)**.

## How the bundle gets here

`www/` is a build artifact, not source. Either stage the dev stub
(`npm run web:placeholder`) or build the real export:

```bash
NEXT_PUBLIC_SHARED_HOST_URL=https://<auth-host> \
NEXT_PUBLIC_APP_MODE=saas-tenant \
  npm run build:web
```

One binary serves all tenants: the shell discovers the tenant at login (email →
`/sas/tenant/discover` on the shared host) and learns/persists the tenant host from
the OAuth callback. To pin a single tenant instead (dev/self-hosted), add
`NEXT_PUBLIC_TENANT_HOST_URL=https://<tenant>`. Frontend checkout defaults to
`~/flamingo/openframe-oss-tenant/…/openframe-frontend`; override with `FRONTEND_DIR`.

`build:web` runs `OPENFRAME_BUILD_TARGET=export npm run build` in the frontend, copies
its `dist/` into `www/`, injects `window.__ENV`, and runs `cap sync`. Once the frontend
moves to its own repo, wire it as a submodule or CI artifact (mobile-app-plan.md §3).

## Notes

- **Capacitor 8 → Swift Package Manager.** No CocoaPods. Open `ios/App/App.xcodeproj`
  directly; Xcode resolves the Capacitor packages.
- **Android** platform is in (`android/`, push plugin + `POST_NOTIFICATIONS` wired) and
  builds: `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug`
  (or open `android/` in Android Studio). FCM needs a Firebase project's
  `google-services.json` in `android/app/` (the Gradle template auto-applies the
  google-services plugin when the file exists).
- **Push notifications are wired**: all-FCM via `@capacitor-firebase/messaging` (FCM
  brokers APNs) + `aps-environment` entitlement + remote-notification background mode.
  Needs each Firebase project's `GoogleService-Info.plist` (iOS). The JS side lives in the frontend
  (`src/lib/native-push.ts`, post-login). Device builds need a **paid** Apple team now
  (free provisioning rejects the push entitlement); simulator builds are unaffected.
- Other native plugins (biometrics/camera/secure-storage) are intentionally not
  installed yet — see mobile-app-plan.md §6.
