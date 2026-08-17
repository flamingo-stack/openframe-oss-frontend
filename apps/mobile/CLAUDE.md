# openframe-mobile

Capacitor 8 **iOS + Android shell** for OpenFrame. **No UI code lives here** — it bundles
the `openframe-frontend` static export (separate repo: `~/flamingo/openframe-frontend`,
built with `OPENFRAME_BUILD_TARGET=export`). iOS uses SPM, **no CocoaPods**.

Architecture context: the OpenFrame knowledge graph at
`~/Documents/Obsidian Vault/OpenFrame/` — start at `OpenFrame Map.md`, then `openframe-mobile.md`.
Strategy: `~/flamingo/openframe-desktop/docs/mobile-app-plan.md` + `native-apps-strategy.md`.

## Commands

- `npm run build:web` — frontend export → `www/` → inject `window.__ENV` → `cap sync`
- `npm run web:placeholder` — dev stub bundle (no frontend build needed)
- `npx cap sync ios` — copy `www/` → `ios/App/App/public/`, regen configs + `Package.swift`
- `npx cap run ios` / `npx cap open ios`
- `npm run push:demo` — `simctl push` `dev/push-sample.apns` to a booted simulator
- Android CLI build — no system Java; use Android Studio's bundled JBR:
  ```sh
  cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    ./gradlew assembleDevDebug     # flavors: assemble{Prod,Stage,Dev}Debug
  ```

`build:web` env vars — **baked at build time, so re-run when any changes**:

| var | notes |
|---|---|
| `NEXT_PUBLIC_SHARED_HOST_URL` | **required** — discovery + login + dev-exchange |
| `NEXT_PUBLIC_APP_MODE` | `saas-tenant` for SaaS builds |
| `NEXT_PUBLIC_TENANT_HOST_URL` | optional single-tenant pin; without it the shell learns the tenant host at login (discovery `domain` + callback origin) |
| `NEXT_PUBLIC_MOBILE_APP_SCHEME` | OAuth callback scheme baked into the bundle |
| `NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER` | dev-ticket observer toggle |
| `FRONTEND_DIR` | frontend checkout override (default `~/flamingo/openframe-frontend`) |

`www/` and `ios/App/App/public/` are git-ignored artifacts — a fresh clone must stage a
bundle (`web:placeholder` or `build:web`) + `cap sync` before Xcode can build.

## Native code (all of it)

New native features: npm plugin → `cap sync` → Xcode capability → call from TS. See
`docs/using-native-apis.md` (worked push example) — **don't write Swift unless no plugin
exists.**

- **`NativeAuthPlugin`** — `ios/App/App/NativeAuthPlugin.swift`, mirrored on Android by
  `android/app/src/main/java/ai/openframe/mobile/NativeAuthPlugin.java` (same jsName +
  method surface). Backs frontend `src/lib/native-shell.ts`. Methods: `start` (system-browser
  login), `exchangeTicket` (dev-ticket → tokens, reads `Access-Token`/`Refresh-Token`
  headers), `get`/`set`/`clearTokens`, `getSafeAreaInsets` (reads the **window**, not the
  web view — see the fullscreen gotcha below; `env()` insets read 0 only for the first
  ~100ms after load, measured on iOS 26.5 — not permanently), and
  `isBiometricAvailable` / `isBiometricLoginEnabled` /
  `enableBiometricLogin` / `disableBiometricLogin`. The callback scheme is registered in
  **Info.plist `CFBundleURLTypes`** (iOS) and **`strings.xml` + the manifest intent-filter**
  (Android).
- **`NativeFilesPlugin`** — `ios/App/App/NativeFilesPlugin.swift`, mirrored on Android by
  `android/app/src/main/java/ai/openframe/mobile/NativeFilesPlugin.java` (same jsName +
  method surface). Backs frontend `src/lib/native-files.ts`. Methods: `downloadFile`
  (fetch a URL natively → iOS share sheet / Android `MediaStore.Downloads`, share chooser
  below API 29; resolves `{savedToDownloads}` so the caller knows whether the landing was
  visible to the user or silent), `pickFiles`
  (OS picker → native **paths**, not `File`s), `uploadFile` (stream a path to a presigned
  URL). See the attachments gotcha below for why none of this can happen in the WebView.
  `uploadFile` refuses a `path` outside its staging dir on both platforms — it streams
  that file out and then deletes it, and the path arrives from JS.
- **`MainViewController.swift`** — registers local plugins with the bridge; enables WKWebView
  **edge-swipe back** (`allowsBackForwardNavigationGestures` → WebKit history incl.
  `pushState` → SPA `popstate`).
- **`AppDelegate.swift`** — stock + the three APNs forwarding methods
  `@capacitor-firebase/messaging` requires (NotificationCenter posts; Firebase
  auto-configures in the plugin's `load()`).

### Token storage & biometrics

Both tokens live in **one item** — iOS Keychain service `ai.openframe.mobile.auth`
account `tokens`, `WhenUnlockedThisDeviceOnly`; Android one RSA-wrapped Keystore blob,
device-bound. With biometric login on, that item is access-control-bound (iOS
`.biometryCurrentSet`; Android `BiometricPrompt`+`CryptoObject` on an auth-required RSA
key), so a gated read shows **one** prompt and writes stay silent.
`NSFaceIDUsageDescription` is in Info.plist.

- **Enable verifies with an OS prompt.** iOS `evaluatePolicy` — this also surfaces the
  one-time Face ID permission alert at opt-in rather than at the next cold start. Android
  runs one `BiometricPrompt`+`CryptoObject` round-trip of the freshly gated blob, so a
  crypto/provider mismatch fails at enable, not after the ungated copy is gone.
- **Android enable regenerates the bio keypair.** An enrollment-invalidated keypair still
  wraps silently but can never decrypt — without the reset, re-enable loops
  `BIOMETRIC_INVALIDATED` forever.
- Frontend settings toggle + cold-start unlock gate: `native-biometrics.ts`,
  `token-store.ts` in `openframe-frontend`.
- Detail: vault `Authentication/Mobile Auth - Token Storage, Biometrics, Passkeys`.

### Push (all FCM)

`@capacitor-firebase/messaging` only — **don't add `@capacitor/push-notifications`**; FCM
brokers APNs. The Firebase iOS SDK comes via SPM (the `experimental.ios.spm…symlink:true`
block in `capacitor.config.ts` avoids a package-identity collision).

- Foreground banners are suppressed on both platforms (`presentationOptions: []`; Android
  FCM never auto-displays while foregrounded). `notificationReceived` still fires for
  in-app handling.
- `UIBackgroundModes: remote-notification` in Info.plist; `App/App.entitlements`
  (aps-environment) is hooked into both App-target configs (needs a paid Apple team).
- Permission is requested by the frontend **after login** (`src/lib/native-push.ts`), not
  at launch — so `push:demo` banners only show after that in-app grant. Token lifecycle +
  settings live there too (`registerPushDevice`/`unregisterPushDevice`,
  `notificationSettings`).
- **Before push delivers**, three manual steps: iOS plist in the App target's **Copy Bundle
  Resources**, APNs `.p8` uploaded to Firebase, Push capability on the App ID.

### Native chrome + navigation

`@capacitor/splash-screen` + `@capacitor/status-bar` + `@capacitor/app` +
`@capacitor/keyboard`, all driven from `openframe-frontend`.

- **Splash** — `launchAutoHide:false`, `#161616` bg; `hideSplashScreen()` fires after token
  hydration settles, so it covers a cold-start biometric prompt.
- **Status bar** — overlays the WebView, light content on the `#161616` safe-area band
  (`initNativeChrome()` in `native-shell.ts`).
- **Keyboard** — `resize: 'none'`; the height reaches CSS only as `--of-keyboard-inset`,
  published from `keyboardWillShow`/`Hide` by frontend `keyboard-inset.ts`. See the
  keyboard gotcha below for why `'none'` and not the default `'native'`.
- **Back** — iOS uses the WKWebView edge-swipe (above); Android routes hardware/gesture back
  through `@capacitor/app` → `native-back.ts` (close topmost overlay → SPA `history.back()`
  → `App.exitApp()`).
- **Icon + splash art** — generated by `@capacitor/assets` from `assets/` vector sources.
  See the naming gotcha below.

### Connectivity

`@capacitor/network`, consumed by frontend `src/lib/connectivity.ts` — the single signal
behind react-query's `onlineManager`, the offline banner, and the Relay retry policy.

It exists because **WKWebView's `navigator.onLine` is accurate but LATE**, and
`onlineManager` is driven by exactly those two window events, which decide when a paused
query may resume. Measured on an iPhone 15 Pro Max (iOS 26.6) across airplane-mode cycles:
the plugin reported `connected=false` **2.0s before** the `offline` event, and reported
`connected=true` while `navigator.onLine` still read `false` — the `online` event trailed
by ~2.5s in one run and ~60s in another. Paused queries then completed within ~500ms of the
event landing: the resume path was never broken, it was starved. The browser keeps the
standard events, where they are accurate.

This is **link** reachability, not gateway reachability — a captive portal reports
connected. Request outcomes stay the source of truth; this only answers "is there a link,
and did it just come back". Detail: vault `OpenFrame/Frontend - Offline and Error Handling`.

## Auth flow (prototype — dev-ticket path)

Login runs in the **system browser** (ASWebAuthenticationSession / Chrome Custom Tabs), not
a WebView: Google blocks embedded-webview OAuth with `403 disallowed_useragent`.

```
{SHARED_HOST}/oauth/login?tenantId=…&authMobile=true&redirectTo=com.openframe.app://auth
  → BFF exchanges the code server-side
  → gateway 302s the ticket to com.openframe.app://auth?devTicket=…
  → native GET /oauth/dev-exchange → tokens → Keychain/Keystore
  → WebView calls send Authorization: Bearer; refresh via /oauth/refresh (Refresh-Token header)
```

The scheme callback carries no host — the tenant gateway host comes from discovery `domain`
(backend guarantees the exact canonical host; format `test-dev.openframe.build`). Custom
scheme rather than `Callback.https` because claimed-https needs an Associated Domains
entitlement + AASA the infra doesn't have. Hardening backlog (PKCE, POST exchange,
rotation): vault `Authentication/Mobile Auth - Client Follow-ups After Backend Hardening.md`.

## Per-env builds (prod / stage / dev)

Three identities install side by side. Android uses product flavors; iOS mirrors them with
build configurations.

| | prod | stage | dev |
|---|---|---|---|
| bundle id / applicationId | `ai.openframe.mobile` | `….stage` | `….dev` |
| display / launcher name | OpenFrame | OF Stage | OF Dev |
| iOS scheme + configs | `App`, Debug/Release | `App Stage`, `Debug-stage`/`Release-stage` | `App Dev`, `Debug-dev`/`Release-dev` |
| OAuth scheme (iOS native) | `com.openframe.app` | `….stage` | `….dev` |
| Firebase project | `firebase-94qh` | `firebase-6lif` | `firebase-nwp3` |

- iOS identity is driven by the **`OPENFRAME_DISPLAY_NAME` / `OPENFRAME_URL_SCHEME` build
  settings** that Info.plist references — the prod configs must define them too.
- A **"Select Firebase config" build phase** swaps in
  `App/GoogleServices/{stage,dev}/GoogleService-Info.plist`, keyed off the `*-stage`/`*-dev`
  config-name suffix.
- **On iOS every lane bakes plain `com.openframe.app`** into the bundle even for stage/dev —
  ASWebAuthenticationSession intercepts the callback session-internally, so the baked scheme
  need not match `OPENFRAME_URL_SCHEME`. On **Android it MUST match** the intent-filter scheme.
  The frontend reads the baked value via `runtimeEnv.mobileAppScheme()`.
- Shared schemes `App` / `App Stage` / `App Dev` are committed — CLI and CI builds need them.
- Release lanes: `scripts/build-{ios,android}-{prod,stage,dev}.sh`. Stage/dev go to
  TestFlight / Firebase App Distribution; see `docs/release-{ios,android}-stage.md` for the
  one-time ASC/APNs/App-Distribution setup and `docs/release-{ios,android}-prod.md` for the
  store-submission checklists.
  `ITSAppUsesNonExemptEncryption` is set in Info.plist so uploads skip the per-build
  export-compliance prompt.
- **Store lanes differ from the others.** `build-android-prod.sh` emits a **signed AAB**
  (`bundleProdRelease`) — Play rejects APKs and unsigned bundles, so it hard-fails when the
  `OF_UPLOAD_*` keystore vars are absent rather than letting Gradle log-and-continue. Bump
  per upload with `VERSION_CODE=`/`VERSION_NAME=` (wired to `-PofVersionCode`/`-PofVersionName`).
  `build-ios-prod.sh` takes `BUILD_NUMBER=` and asserts the exported **.ipa**'s
  `aps-environment` is `production` (see the signing gotcha below).
- `aps-environment` comes from the per-configuration **`APS_ENVIRONMENT` build setting**
  (`development` in Debug\*, `production` in Release\*), which `App.entitlements` references.
  Don't hardcode it back — a `development` value ships a binary whose push silently dies.
- **The archive is dev-signed; only the export is distribution-signed.** This team uses
  **cloud-managed** signing — there is no Apple Distribution cert in the local keychain
  (`security find-identity -v -p codesigning` lists Apple Development only). So
  `xcodebuild archive` signs with the local Apple Development identity + the team
  *development* profile, and the archived `App.app` reads `aps-environment=development`,
  `get-task-allow=true`, **regardless of the Release configuration**. `-exportArchive
  -allowProvisioningUpdates` is what fetches the Cloud Managed Apple Distribution cert +
  "iOS Team Store Provisioning Profile" and re-signs — the exported `.ipa` reads
  `production` / `get-task-allow=false`. Verified on both lanes (prod + stage). Any
  entitlement assertion must therefore run on `build/<env>/DistributionSummary.plist` (or
  the ipa itself) **after** the export; the same check on the archive fails 100% of the
  time on a correct build.
- **iPhone-only**: `TARGETED_DEVICE_FAMILY = 1`. The console layout has never been validated
  at iPad width, and claiming iPad means Apple reviews it there.

**Firebase config files are all gitignored** — supplied out-of-band, see
`android/app/src/README.md`:

```
android/app/src/{prod,stage,dev}/google-services.json   # Gradle processGoogleServices
                                                        # validates each against its flavor
ios/App/App/GoogleService-Info.plist                    # prod
ios/App/App/GoogleServices/{stage,dev}/…                # swapped in by the build phase
```

`firebase/` is a gitignored staging dir for source exports. **Always map a config to its env
by BUNDLE_ID/package_name, never by folder name** — exports have arrived with prod↔stage
swapped.

## Gotchas (hard-won)

- **Simulator builds must be signed**: `CODE_SIGN_IDENTITY="-"`. Never
  `CODE_SIGNING_ALLOWED=NO` — unsigned sim apps fail `SecItemAdd` **silently**, so Keychain
  tokens don't persist across restarts.
- **Both tokens must be written together.** Reading two separately-gated items triggered
  **two** Face ID prompts on device; one combined blob ⇒ one prompt. So the frontend
  `token-store` always sends the full pair — a partial write would drop the other token.
  Enrollment change invalidates the item (`.biometryCurrentSet` /
  `setInvalidatedByBiometricEnrollment`) → `BIOMETRIC_INVALIDATED` → frontend force-relogins.
- **Biometric flows are device-only to verify.** The Simulator can enroll Face ID but won't
  exercise the gated Keychain/Keystore path fully.
- **Nothing shrinks the layout viewport when the keyboard opens.** WKWebView keeps its frame
  (Capacitor's iOS core has no keyboard code at all) and Android's window is edge-to-edge at
  `targetSdk 36`, where `adjustResize` is inert and the IME is a `WindowInsets` type. So
  `inset-0` / `100dvh` / `%` heights all keep reporting the full screen, and a bottom-anchored
  or viewport-centered overlay opens **fully behind** the keyboard. The height reaches CSS
  only via `--of-keyboard-inset` (frontend `keyboard-inset.ts`), consumed by **three** layers:
  the core-lib overlay primitives (modal-v2/dialog/alert-dialog — viewport-`fixed`, so they
  escape the layout and pad themselves); the layout root
  (`html[data-shell="mobile"] .app-shell-root` in frontend `globals.css`), which absorbs it as
  `padding-bottom` so the whole in-layout tree — including the Mingo drawer and the ticket
  client chat — shrinks the way `adjustResize` would; and the core-lib Radix poppers, which
  feed it back as `collisionPadding.bottom` (`useKeyboardCollisionPadding`) because
  floating-ui takes its collision viewport from `visualViewport` and would otherwise place a
  search dropdown straight behind the keyboard its own field just raised. Anything
  bottom-anchored that is *none* of the three (a `fixed` bar of its own) is still uncovered.
  Keep `resize: 'none'`: it's an **iOS-only** knob — Android has no resize
  option, only events — so any other value splits the two platforms across two mechanisms,
  and `'native'` shrinks the WKWebView out from under the UIKit safe-area insets, floating
  the home-indicator band above the keyboard.
- **Attachment capture needs BOTH camera and microphone usage strings.** WKWebView's
  own file picker offers "Take Photo or Video" for any input accepting media, and iOS
  **terminates** the app the instant that reaches the camera without
  `NSCameraUsageDescription` — not an error, a crash. The video arm records audio, so
  `NSMicrophoneUsageDescription` is required for the same reason.
  `NativeFilesPlugin.pickFiles` offers the same option. Removing either key brings the
  crash back; remove the option from both pickers first if the permission is unwanted.
- **Leaving iOS element fullscreen breaks the safe areas, and no JS can fix it.** WebKit
  hands the WKWebView back with its scroll view's `contentInsetAdjustmentBehavior` reset
  from Capacitor's `.never` to `.automatic`, and nothing restores it until a rotation. The
  scroll view then insets the page by the safe area, so the **layout viewport** loses it
  (measured 874 → 770pt, iPhone 17 Pro / iOS 26.5) while `env()` and `getSafeAreaInsets`
  keep reporting the full inset — every `--native-safe-*` consumer pads a second time
  inside a viewport that already excludes the band, so the app comes back with a doubled
  top band and ~84pt of dead space at the bottom. Republishing insets from JS cannot help:
  the values are correct reads of a broken viewport. `MainViewController` KVOs
  `WKWebView.fullscreenState` (iOS 16+) and restores the configured behavior on
  `notInFullscreen`. WebKit ALSO strands the web view's own `safeAreaInsets` at its
  fullscreen container's values (bottom 34 → 42pt) and no public UIKit call recomputes
  them — not `layoutIfNeeded`, not a frame cycle, not `additionalSafeAreaInsets`, not
  remove/re-add — which is why `getSafeAreaInsets` measures the **window** instead. Both
  fullscreen entry points are affected: the walkthrough video's Mux player (media-chrome
  calls `requestFullscreen()`, since Capacitor sets `isElementFullscreenEnabled`) and the
  remote-desktop canvas. Raw `env(safe-area-inset-bottom)` — the core lib's floating
  walkthrough card — still reads the stranded 42 until a rotation; prefer
  `--native-safe-*`.
- **Nothing downloads from the WebView.** Neither shell has a download handler — Capacitor
  implements no `WKDownloadDelegate`/`didBecome download:` on iOS (its `decidePolicyFor`
  hands non-app top-level navs to `UIApplication.open`, which can't open `blob:`) and never
  calls `setDownloadListener` on Android. So `URL.createObjectURL` + `<a download>.click()`
  — the web idiom — **silently does nothing**: the click returns, no error is thrown, and no
  `catch`/toast ever fires, which is why it reads as "the button is dead". Verified on the
  simulator: `a.click()` returns clean, `window.open(blobUrl)` returns `null`, `data:` URLs
  likewise. A file fetched from a URL must go through `NativeFiles.downloadFile`
  (frontend `downloadFileToDevice`). Still on the broken idiom, all of them saving a
  locally-generated blob rather than a URL, so `downloadFile` cannot serve them as-is:
  core-lib `query-report-table/utils.ts` (CSV export), `devices/new` (installer script),
  `lib/meshcentral/file-downloader.ts`. Fixing those needs a base64 `saveFile` method —
  written once, then removed as dead code when nothing called it.
- **Attachment uploads PUT straight to `storage.googleapis.com`** (presigned GCS URLs from
  `GcsPresignedUrlService`), so the bucket's CORS policy — not the gateway's — governs them,
  and it must name `capacitor://localhost` **and** `https://localhost` (Android) or every
  upload fails preflight. `NativeFiles.pickFiles` + `uploadFile` sidestep it by streaming
  from a native path, and every attachment surface now routes through them — the core-lib
  `FileUpload` dropzone takes a `pickFiles` override as of
  `@flamingo-stack/openframe-frontend-core` **0.0.532**. Device-verified: picker opens,
  photo upload succeeds. Two paths deliberately stay on the WebView: the device
  file-manager upload (`file-manager-container.tsx`, uploads over the MeshCentral
  WebSocket, not GCS) and **KB inline article images** (`use-article-image-upload.ts`) —
  that one IS a presigned GCS `PUT` from the WebView, so it's the last place bucket CORS
  can still bite, and it can't use `pickFiles` (the MarkdownEditor hands it a `File`).
- **The WebView origin is `capacitor://localhost`** — the tenant gateway CORS must allow it
  (incl. **exposing** `Access-Token`/`Refresh-Token`) or the shell renders but every data
  call 401s. Cookies don't work cross-origin; bearer mode is mandatory. Configured on
  test-dev and prod; still required on any new/self-hosted gateway. **`/content/*` too** —
  the shell absolutizes Help Center + chat content calls to `{tenantHost}/content/*` (no
  Next server to proxy them).
- **A nav to an unprerendered path silently reloads the app at `/`.** Capacitor's
  `CapacitorRouter` maps **every** extensionless path to `basePath + "/index.html"` — the
  ROOT one, never the route's own. That's harmless in normal operation (the WebView only
  ever hard-loads `/`; everything after is a soft-nav fetching `.txt` RSC payloads, which
  have an extension and resolve), but it means the export bundle must contain a payload for
  every path the app navigates to. When one is missing, Next's soft-nav fails, falls back to
  a hard navigation, and gets the root shell back — no error, no 404 screen, the app just
  appears to restart. So `output: 'export'` + a `[slug]` route whose slugs are CMS content
  is unroutable here, and a placeholder `generateStaticParams` does **not** rescue it (it
  prerenders only the placeholder). Frontend `src/lib/ROUTES.md` encodes the rule — detail
  pages carry the id/slug as a query param on a prerendered path. This bit the Help Center
  guide + release detail routes, whose comments claimed "the native shell's SPA fallback"
  served real slugs; no such per-route fallback exists.
- **`@capacitor/network` on iOS fails SILENTLY into permanent-offline.** The plugin is not
  `NWPathMonitor` — it vendors Ashley Mills' `Reachability.swift` over
  `SCNetworkReachability`, and its `load()` wraps `try Network()` in a `do/catch` that only
  `CAPLog.print`s the failure, leaving `implementation` **nil**. From then on `getStatus`
  resolves `Network.Connection.unavailable` (`connected:false`) forever and
  `networkStatusChange` never fires, because the observer is attached inside the `try`. The
  app would report offline on a working network and pause every query. Frontend
  `connectivity.ts` only defends against the bridge *throwing*, not against this — if the
  banner is stuck, check the device log for "Unable to start network monitor".
- **The plugin adds `ACCESS_NETWORK_STATE` to the Android manifest** by merge (its own
  `AndroidManifest.xml`), so the permission appears in the built APK/AAB without showing up
  in `android/app/src/main/AndroidManifest.xml`. Expect a Play listing diff on the next
  upload.
- **Live-reload `server.url` must be removed before any shippable build.** The release lanes
  hard-fail if one is present.
- **SSO consent prompt name = `CFBundleName`**, not `CFBundleDisplayName`. The
  ASWebAuthenticationSession "'X' Wants to Use … to Sign In" alert reads `CFBundleName`; it's
  pinned to `OpenFrame` in Info.plist (was `$(PRODUCT_NAME)` = "App"). Don't change
  `PRODUCT_NAME`/`TARGET_NAME` — that renames the `.app`, executable, and scheme.
- **Android backup must stay off.** `SecureTokenStore` keeps its blob in a plain
  SharedPreferences file wrapped by a device-bound Keystore key, so any copy that lands on
  another device is permanently undecryptable — a restored user gets a broken auth state,
  not a clean logout. `allowBackup="false"` alone is not enough: on Android 12+ it does
  **not** stop device-to-device transfer, hence `res/xml/data_extraction_rules.xml`.
- **Android biometric OAEP** (`SecureTokenStore`): the gated-storage RSA wrap/unwrap must pin
  `OAEPParameterSpec` with **MGF1 = SHA-1 on BOTH sides**. A software-provider public-key
  wrap defaults to MGF1-SHA256 while the AndroidKeyStore private-key unwrap uses SHA-1, so
  `doFinal` throws `BadPaddingException` **after** the fingerprint prompt (gated read
  silently fails → user bounced to login, enabled-marker cleared). The bio key alias is
  versioned (`.bio.v2`); a device that enabled biometrics on an older build needs a clean
  reinstall.
- **`@capacitor/assets` source naming**: the splash logo is `assets/splash-logo.svg` /
  `openframe-symbol.svg` — NOT `logo.*` or `icon-*`, which are treated as **app-icon** sources
  and would regenerate the home-screen icon. Icon sources: `assets/icon-only.png` (opaque
  tile, **no alpha** — iOS rejects alpha in icons) + `icon-foreground/background.png`
  (Android adaptive).
- **Android launcher label is `title_activity_main`, not `app_name`** — the launcher shows the
  *activity* label, so per-flavor `android/app/src/{stage,dev}/res/values/strings.xml` must
  override both or the icon still reads "OpenFrame".
- **Android Studio stale variant**: with flavors there is no plain `debug` variant, only
  `devDebug`/`stageDebug`/`prodDebug`. Gradle Sync, then pick a flavored variant in Build
  Variants. The CLI (`assembleDevDebug`) is unaffected.
- **Generated files** — `capacitor.config.json`, `config.xml`, `CapApp-SPM/Package.swift`.
  Edit `capacitor.config.ts` instead; never hand-edit `Package.swift` (CLI-managed).

## Debugging on the simulator (autonomous loop)

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=<booted>' CODE_SIGN_IDENTITY="-" build
xcrun simctl install booted <.app>
xcrun simctl launch --console-pty booted ai.openframe.mobile   # JS console + every JS→native call
xcrun simctl io booted screenshot f.png
```

**Always pass `-configuration` explicitly.** Without it xcodebuild takes the scheme's
*Launch* action config, and the shared `App` scheme currently has that set to `Debug-stage`
— so a bare `-scheme App` builds `ai.openframe.mobile.stage`, a **different bundle id** that
installs beside the prod app with its own empty Keychain. It looks like the session was
lost. Same trap in Xcode's Run button and `npx cap run ios`. Confirm what you built:
`/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" <.app>/Info.plist`, and check which
app the user actually signed into with `xcrun simctl get_app_container booted <id> data`.

**The simulator has no airplane mode** — it shares the host's network, so toggle the Mac's
Wi-Fi to exercise offline paths. `SCNetworkReachability` sees that.

Synthetic taps are impossible — inject JS probes into `ios/App/App/public/index.html` and
rebuild instead. WebView inspector: Safari → Develop.

## Docs

`docs/project-structure.md` (pipeline, committed-vs-generated) · `docs/using-native-apis.md`
(plugin pattern) · `docs/run-on-iphone.md` (device/simulator/signing/live-reload/env) ·
`docs/release-ios-prod.md` · `docs/release-android-prod.md` (store submission checklists) ·
`docs/release-ios-stage.md` · `docs/release-android-stage.md`.

**After structural changes** (new plugin, auth change, pipeline change, new platform), update
the Obsidian note `OpenFrame/openframe-mobile.md` and bump its `updated` field.
