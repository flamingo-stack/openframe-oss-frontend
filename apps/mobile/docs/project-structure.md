# Project structure & build pipeline

How `openframe-mobile` is laid out, how the `openframe-frontend` UI gets bundled into
it, where the Capacitor code lives, and exactly what each platform build generates.

---

## 1. The three layers

There is **one UI codebase** (`openframe-frontend`) and a **thin native shell**
(`openframe-mobile`). The shell never contains UI source — it consumes a *built static
bundle* of the frontend.

```
┌─ openframe-frontend ───────────────┐   Next 16 App Router source (separate repo/monorepo)
│  src/app/**, components, lib …      │   the SAME code that serves the web app
└───────────────┬─────────────────────┘
                │  OPENFRAME_BUILD_TARGET=export  npm run build
                ▼
        dist/   (static SPA: HTML per route + _next/ JS/CSS + RSC .txt payloads)
                │  scripts/build-web.sh:  cp dist → www/,  inject window.__ENV
                ▼
┌─ openframe-mobile ─────────────────┐
│  www/  ← the staged bundle          │   (git-ignored build artifact)
│        │  npx cap sync               │   (cap copy + cap update)
│        ▼                             │
│  ios/App/App/public/  ← baked-in web │   (git-ignored, regenerated)
│        │  Xcode / xcodebuild         │
│        ▼                             │
│  OpenFrame.app / .ipa                │   native host + Capacitor runtime + public/
└─────────────────────────────────────┘
```

The native shell adds only what the web can't do (notifications, biometrics, camera);
everything a user sees is the shared frontend.

---

## 2. Repository layout

```
openframe-mobile/
├─ capacitor.config.ts        # SOURCE config: appId, appName, webDir, dev server.url
├─ package.json               # Capacitor deps + build/run scripts
├─ scripts/
│  ├─ build-web.sh            # build frontend export → www/ → inject env → cap sync
│  ├─ make-placeholder-web.mjs# dev stub bundle (run on device w/o building the frontend)
│  └─ inject-env.mjs          # prepend window.__ENV to www/index.html
├─ dev/
│  └─ push-sample.apns        # sample payload for `npm run push:demo` (simulator)
├─ assets/                    # brand SOURCES for @capacitor/assets: openframe-symbol.svg +
│                             # icon-*.png (app icon), splash-logo.svg + splash*.png (splash)
├─ docs/                      # this file, run-on-iphone.md, …
├─ www/                       # ← STAGED WEB BUNDLE (git-ignored, from build:web)
└─ ios/                       # ← native Xcode project (committed, minus generated bits)
```

**Committed (source of truth)** vs **generated (git-ignored, rebuilt on demand):**

| Committed | Generated / git-ignored |
|---|---|
| `capacitor.config.ts`, `package.json`, `scripts/`, `docs/`, `dev/` | `node_modules/`, `www/` |
| `ios/App/App.xcodeproj` (the project) | `ios/App/App/public/` (copied web bundle) |
| `ios/App/App/AppDelegate.swift`, `Info.plist`, `Assets.xcassets`, `Base.lproj` | `ios/App/App/capacitor.config.json`, `config.xml` (generated from `.ts`) |
| `ios/App/CapApp-SPM/Package.swift` (Capacitor runtime manifest) | `ios/DerivedData/`, `App/build/`, `xcuserdata/`, `.swiftpm/` caches |
| `ios/.gitignore`, `ios/debug.xcconfig` | |

> A fresh clone has no `www/` and no `public/`. You must `npm run web:placeholder`
> (or `build:web`) **and** `npx cap sync` before the Xcode build has a web bundle.

---

## 3. How the frontend is bundled

Everything runs through **`npm run build:web`** (`scripts/build-web.sh`):

0. **Get the frontend** — by default the local checkout at `FRONTEND_DIR`
   (`~/flamingo/openframe-frontend`), built as-is. For a store build set
   `FRONTEND_REF=<release tag>` instead (e.g. `FRONTEND_REF=1.0.127`): the script
   makes a fresh shallow clone of `openframe-oss-frontend` at that tag into
   `.frontend/` (git-ignored) and runs `npm ci` there, so the shipped bundle is
   exactly that release and reports it as its version (`X-OpenFrame-Client`).
1. **Build the frontend as a static export** — in the frontend repo it runs
   `OPENFRAME_BUILD_TARGET=export npm run build`. That env flag flips
   `next.config.mjs` from `output: 'standalone'` (the web server build) to
   `output: 'export'`, emitting a static SPA into **`dist/`**. The export contains:
   - `index.html` + one `index.html` **per route** (`dashboard/`, `customers/`,
     `devices/`, …) — the dynamic dashboard routes are static query-param pages
     (`/devices/details?id=…`), so deep links resolve to a real file;
   - `_next/static/**` — hashed JS/CSS chunks and fonts;
   - `_next/<buildId>/` — build manifest;
   - `__next.*.txt` / `<route>/…txt` — React Server Component payloads used for
     client-side navigation.
2. **Stage it** — `cp -R <frontend>/dist  www/` (the whole bundle becomes `www/`).
3. **Inject runtime config** — `inject-env.mjs` prepends
   `<script>window.__ENV = { NEXT_PUBLIC_TENANT_HOST_URL, … }</script>` to
   `www/index.html`. The static bundle has **no server**, so this is how it learns its
   tenant host (next-runtime-env reads `window.__ENV`; the frontend's
   `runtime-config.ts` also falls back to `window.process.env`). Pass the vars to
   `build:web` — they go into both the build and `window.__ENV` so build-time and
   runtime agree.
4. **Sync into native** — `npx cap sync` (see §5) copies `www/` into the iOS project.

The frontend repo is the source; `www/` is a disposable copy. When the frontend moves
to its own repo, wire it as a git submodule or CI artifact (see
`mobile-app-plan.md` §3) — the pipeline is unchanged.

---

## 4. Where the Capacitor code lives

"Capacitor" is four things in this repo:

1. **Config (source):** `capacitor.config.ts` — `appId: ai.openframe.mobile`,
   `appName: OpenFrame`, `webDir: www`, and an optional dev `server.url` for live
   reload. `cap` reads this `.ts` (TypeScript is a devDependency for that reason).
2. **Config (generated):** `ios/App/App/capacitor.config.json` — emitted from the `.ts`
   on every `cap copy`, bundled into the app and read by the native runtime at launch.
   Git-ignored; never edit it directly.
3. **Native runtime (Swift, via SPM):** `ios/App/CapApp-SPM/Package.swift` declares the
   dependency on `capacitor-swift-pm` (the Capacitor + Cordova native libraries),
   pinned to the CLI version (`exact: "8.4.1"`). Xcode resolves it — **this is why
   there's no CocoaPods.** The file is CLI-managed (`// DO NOT MODIFY`).
4. **Native host (Swift, yours):** `ios/App/App/AppDelegate.swift` boots the app and a
   `CAPBridgeViewController` (a `WKWebView` host that loads `public/`). This is the only
   Swift you touch — e.g. the notification-authorization request we added.

**Plugin code** (push, camera, …): each plugin is an npm package whose JS you import in
the web layer and whose Swift/Kotlin `cap sync` wires into the native project. Installed
today: `@capacitor-firebase/messaging` — all push goes through Firebase/FCM, which
brokers APNs (`@capacitor/push-notifications` was removed). Its JS is driven from the
frontend's `src/lib/native-push.ts`; the shell adds the `aps-environment` entitlement,
`remote-notification` background mode, and the APNs forwarding methods in
`AppDelegate.swift`. Also installed: `@capacitor/splash-screen` + `@capacitor/status-bar`
(native launch chrome) and `@capacitor/app` (Android hardware back) — all driven from the
frontend (`native-shell.ts`, `native-back.ts`). App icon + splash images are generated by
`@capacitor/assets` from the vector sources in `assets/`. The build *glue* (`scripts/*.mjs`,
`.sh`) is plain TypeScript/JS.

---

## 5. What exactly gets generated for a platform

### `npx cap add ios` — ONE-TIME, scaffolds the platform
Generates the committed Xcode project from Capacitor's template:
- `ios/App/App.xcodeproj/` — the Xcode project (`project.pbxproj`, workspace).
- `ios/App/App/AppDelegate.swift`, `Info.plist`, `Assets.xcassets`, `Base.lproj/` — the
  native host app.
- `ios/App/CapApp-SPM/Package.swift` — the SPM manifest for the Capacitor runtime.
- `ios/capacitor-cordova-ios-plugins/` — bridge for any Cordova plugins (empty here).
- `ios/.gitignore`, `ios/debug.xcconfig`.

You run this once; the project is committed and edited by hand thereafter.

### `npx cap sync` — EVERY BUILD, refreshes generated bits
`cap sync` = **`cap copy`** + **`cap update`**:
- **copy:** `www/` → `ios/App/App/public/` (an exact mirror — the web bundle the app
  ships), and (re)generates `ios/App/App/capacitor.config.json` + `config.xml` from
  `capacitor.config.ts`.
- **update:** regenerates `Package.swift` to include any installed plugins and resolves
  the Swift packages.

(`npx cap copy` alone is enough when you only changed web assets; `sync` also picks up
plugin changes.)

### `xcodebuild` / Xcode Run — produces the artifact
Xcode compiles `AppDelegate.swift` + the SPM-resolved Capacitor runtime + any plugins,
and bundles `ios/App/App/public/` as the app's web content → **`OpenFrame.app`**
(simulator/device) or **`.ipa`** (distribution). The `.app` is a normal native binary
whose main view is a WebView serving `public/` over the `capacitor://localhost` origin.

### Net per-platform output
| Source (committed) | Generated by `cap sync` | Built by Xcode |
|---|---|---|
| `App.xcodeproj`, `AppDelegate.swift`, `Package.swift` | `public/` (= `www/`), `capacitor.config.json`, `config.xml` | `OpenFrame.app` / `.ipa` |

---

## 6. Android

Added via `npx cap add android` (2026-07-06): a parallel `android/` Gradle project —
`MainActivity` extending `BridgeActivity`, `AndroidManifest.xml` (incl.
`POST_NOTIFICATIONS` for Android 13+ push permission), `build.gradle`, and
`android/app/src/main/assets/public/` (the same `www/` bundle, copied by `cap sync`).
Same pipeline, different host. Building requires Android Studio/JDK.

**Per-env flavors** (`prod`/`stage`/`dev`, dimension `env`): distinct `applicationId`
via suffix — `ai.openframe.mobile`, `.stage`, `.dev` — so all three install
side-by-side, each bound to its own Firebase project. `namespace` stays constant
(`ai.openframe.mobile`), so `MainActivity` is not per-flavor. Build one variant with
`assemble{Prod,Stage,Dev}Debug`; the `www/` bundle lives in the shared `main` source
set, so `cap sync` is flavor-agnostic (only `cap run android` needs `--flavor`).

Push (FCM) requires each env's `android/app/src/{prod,stage,dev}/google-services.json`
from that env's Firebase project (registered for the matching suffixed id). `build.gradle`
applies the google-services Gradle plugin only when at least one such file is present —
so the app stays buildable before the Firebase projects exist.

---

## 7. Command → effect cheat sheet

| Command | Regenerates | When |
|---|---|---|
| `npm run build:web` | `www/` (+ `window.__ENV`) then `cap sync` | after any frontend change |
| `npm run web:placeholder` | `www/` (dev stub) | quick device/sim smoke test |
| `npx cap copy ios` | `ios/App/App/public/`, `capacitor.config.json` | web-only change |
| `npx cap sync ios` | the above + `Package.swift` / SPM | after `npm install <plugin>` |
| `npx cap add ios` | the whole `ios/` project | once |
| Xcode ▶ / `xcodebuild` | `OpenFrame.app` / `.ipa` | to run/ship |
