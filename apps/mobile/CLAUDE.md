# openframe-mobile

Capacitor 8 **iOS + Android shell** for OpenFrame. **No UI code lives here** — it bundles
the `openframe-frontend` static export (separate repo: `~/flamingo/openframe-frontend`,
built with `OPENFRAME_BUILD_TARGET=export`). iOS: SPM, **no CocoaPods**. Android: builds
via Android Studio's bundled JBR — no system Java, so from the CLI use
`JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDevDebug`
in `android/` (per-env flavors: `assemble{Prod,Stage,Dev}Debug`; plain `assembleDebug`
builds all three). Per-env Firebase config (`google-services.json` /
`GoogleService-Info.plist`) is **gitignored** — supply it out-of-band (see
`android/app/src/README.md`); push also needs the APNs `.p8` + Push capability.

Architecture context: the OpenFrame knowledge graph at
`~/Documents/Obsidian Vault/OpenFrame/` — start at `OpenFrame Map.md`, then `openframe-mobile.md`.
Strategy docs: `~/flamingo/openframe-desktop/docs/mobile-app-plan.md` + `native-apps-strategy.md`.

## Commands

- `npm run build:web` — build frontend export → `www/` → inject `window.__ENV` → `cap sync`. Env vars: `NEXT_PUBLIC_SHARED_HOST_URL` (the one required var — discovery + login + dev-exchange), `NEXT_PUBLIC_APP_MODE` (`saas-tenant` for SaaS builds), `NEXT_PUBLIC_TENANT_HOST_URL` (optional single-tenant pin; without it the shell learns the tenant host at login from discovery `domain` + callback origin), `NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER`, `FRONTEND_DIR`. **Baked at build time** — re-run when they change.
- `npm run web:placeholder` — dev stub bundle (no frontend build needed)
- `npx cap sync ios` — copy `www/` → `ios/App/App/public/`, regen configs + `Package.swift`
- `npm run push:demo` — `simctl push` the sample payload (`dev/push-sample.apns`) to a booted simulator
- `npx cap run ios` / `npx cap open ios`

`www/` and `ios/App/App/public/` are git-ignored artifacts — a fresh clone must stage a
bundle (`web:placeholder` or `build:web`) + `cap sync` before Xcode can build.

## Native code (all of it)

- `ios/App/App/NativeAuthPlugin.swift` — the local `NativeAuth` plugin, **mirrored on Android** by `android/app/src/main/java/ai/openframe/mobile/NativeAuthPlugin.java` (same jsName + method surface), backing frontend `src/lib/native-shell.ts`: ASWebAuthenticationSession (iOS) / Chrome Custom Tabs (Android) login on the custom scheme `com.openframe.app` (`start`; scheme in Info.plist `CFBundleURLTypes` / Android `strings.xml` + manifest intent-filter), native dev-ticket exchange reading `Access-Token`/`Refresh-Token` headers (`exchangeTicket`), token storage (`get/set/clearTokens`), `getSafeAreaInsets` (WKWebView/`WindowInsets` report env() insets as 0), and **biometric login** (`isBiometricAvailable`/`isBiometricLoginEnabled`/`enableBiometricLogin`/`disableBiometricLogin`). Both tokens are stored as **one item** (a single JSON/combined blob — iOS Keychain service `ai.openframe.mobile.auth` account `tokens`, `WhenUnlockedThisDeviceOnly`; Android one RSA-wrapped Keystore blob, device-bound). With biometric login on, that item is access-control-bound (iOS `.biometryCurrentSet`; Android `BiometricPrompt`+`CryptoObject` on an auth-required RSA key) so a gated read shows **one** Face ID / fingerprint prompt; writes stay silent; `NSFaceIDUsageDescription` in Info.plist. Frontend settings toggle + cold-start unlock gate live in `openframe-frontend` (`native-biometrics.ts`, `token-store.ts`). Detail: vault `Authentication/Mobile Auth - Token Storage, Biometrics, Passkeys`.
- `ios/App/App/MainViewController.swift` — registers local plugins with the bridge.
- `ios/App/App/AppDelegate.swift` — stock + the three APNs forwarding methods `@capacitor-firebase/messaging` requires (NotificationCenter posts; Firebase auto-configures in the plugin's `load()`). Permission is requested by the frontend after login (`src/lib/native-push.ts`), not at launch — so `push:demo` banners show only after that in-app grant.
- Push wiring (2026-07-21): **all push via Firebase/FCM** — `@capacitor-firebase/messaging` (Firebase iOS SDK pulled via SPM; the `experimental.ios.spm…symlink:true` block in `capacitor.config.ts` avoids a package-identity collision). `@capacitor/push-notifications` was removed (FCM brokers APNs). `UIBackgroundModes: remote-notification` in Info.plist. `App/App.entitlements` (aps-environment) is **re-hooked** into both App-target configs (paid Apple team). Per-env Firebase config files are now in place (2026-07-22): `android/app/src/{prod,stage,dev}/google-services.json` (build-validated — `assembleDebug` matches each to its flavor's applicationId) and iOS `ios/App/App/GoogleService-Info.plist` (prod; stage/dev staged under `ios/App/App/GoogleServices/`) — **all Firebase config files are gitignored** (supplied out-of-band, not committed). **Mapped by bundle ID** — the source export filenames had prod↔stage swapped (prod=`firebase-6lif`/`ai.openframe.mobile`, stage=`firebase-94qh`/`.stage`, dev=`firebase-nwp3`/`.dev`). Still required before push delivers: add the iOS plist to the App target's **Copy Bundle Resources** (Xcode target membership), the APNs `.p8` auth key uploaded to Firebase, and Push capability on the App ID. FCM token lifecycle + notification settings live in the frontend `src/lib/native-push.ts` (push contract: `registerPushDevice`/`unregisterPushDevice`, `notificationSettings`).

New native features: npm plugin → `cap sync` → Xcode capability → call from TS.
See `docs/using-native-apis.md` for the pattern (worked push example) — don't write Swift
unless no plugin exists.

## Auth flow (prototype — dev-ticket path)

ASWebAuthenticationSession (system browser — Google blocks embedded-webview OAuth with
403 disallowed_useragent; the earlier WKWebView sheet was replaced 2026-07-17) opens
`{SHARED_HOST}/oauth/login?tenantId=…&authMobile=true&redirectTo=com.openframe.app://auth`
→ BFF handles the code exchange server-side → gateway 302s the ticket straight to
`com.openframe.app://auth?devTicket=…` → session completes → native GET
`/oauth/dev-exchange` → tokens → Keychain → WebView calls send `Authorization: Bearer`;
refresh via `/oauth/refresh` with `Refresh-Token` header. The scheme callback carries no
host — the tenant gateway host comes from discovery `domain` (backend guarantees the
exact canonical tenant host; format `test-dev.openframe.build`). Custom scheme, not
`Callback.https`: claimed-https requires an Associated Domains entitlement + AASA the
infra doesn't have (and a paid team). Hardening backlog (PKCE, POST exchange, rotation):
vault note `Authentication/Mobile Auth - Client Follow-ups After Backend Hardening.md`.

## Gotchas (hard-won)

- **Simulator builds must be signed**: `CODE_SIGN_IDENTITY="-"`. Never
  `CODE_SIGNING_ALLOWED=NO` — unsigned sim apps fail `SecItemAdd` **silently**, so
  Keychain tokens don't persist across restarts.
- **Biometric login stores both tokens as ONE item** — reading two separately-gated
  Keychain/Keystore items triggered **two** Face ID prompts on device; one combined
  blob ⇒ one prompt. So the frontend `token-store` always sends the full token pair (a
  partial write would drop the other token). Enrollment change invalidates the item
  (`.biometryCurrentSet` / `setInvalidatedByBiometricEnrollment`) → `BIOMETRIC_INVALIDATED`
  → the frontend force-relogins. All biometric flows are **device-only** to verify (the
  Simulator can enroll Face ID but won't exercise the gated Keychain/Keystore path fully).
- The WebView origin is `capacitor://localhost` — the tenant gateway **CORS must allow
  it** (incl. exposing `Access-Token`/`Refresh-Token` headers) or the shell renders but
  every data call 401s. Cookies don't work cross-origin; bearer mode is mandatory.
  Configured on test-dev **and prod gateways (2026-07-06)**; still required on any
  new/self-hosted gateway. **`/content/*` routes too (2026-07-17):** in the shell the
  frontend absolutizes Help Center + chat content calls to `{tenantHost}/content/*`
  (no Next server to proxy them), so those gateway routes must send the same CORS.
- Live-reload `server.url` in `capacitor.config.ts` must be **removed before any
  shippable build**.
- `capacitor.config.json`, `config.xml`, `CapApp-SPM/Package.swift` are generated —
  edit `capacitor.config.ts` instead; never hand-edit `Package.swift` (CLI-managed).

## Debugging on the simulator (autonomous loop)

Build: `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'platform=iOS Simulator,name=<booted>' CODE_SIGN_IDENTITY="-" build`
→ `simctl install booted <.app>` → `simctl launch --console-pty booted ai.openframe.mobile`
(captures JS console + every JS→native plugin call). Screenshots: `xcrun simctl io booted
screenshot f.png`. Synthetic taps are impossible — inject JS probes into
`ios/App/App/public/index.html` and rebuild instead. WebView inspector: Safari → Develop.

## Docs

`docs/project-structure.md` (pipeline, committed-vs-generated), `docs/using-native-apis.md`
(plugin pattern), `docs/run-on-iphone.md` (device/simulator/signing/live-reload/env).
Keep the Obsidian note `OpenFrame/openframe-mobile.md` updated after structural changes
(new plugin, auth change, Android platform, pipeline change) — bump its `updated` field.
