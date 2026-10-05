# Contributing to OpenFrame SaaS Mobile

Thanks for your interest in contributing to `openframe-mobile`, the native Capacitor shell for the OpenFrame platform. This document covers the conventions and workflow specific to this repository.

## Before You Start

This repository contains **no UI source code**. All screens, routing, and application logic live in the separate `openframe-frontend` codebase. `openframe-mobile` only contains:

- The Capacitor configuration (`capacitor.config.ts`)
- Native platform projects (`ios/`, `android/`)
- Native plugin code (Swift on iOS, Java on Android) for features the web can't do: authentication, secure token storage, push notifications, and native file I/O
- Build glue scripts (`scripts/`) that stage the frontend's static export into a native app bundle

If your change is about UI, screens, or application behavior, it likely belongs in `openframe-frontend`, not here.

## Community & Support

We don't use GitHub Issues or GitHub Discussions for this project. All discussion, questions, and support happen on the **OpenMSP Slack community**:

- Community site: https://www.openmsp.ai/
- Join Slack: https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA

Please reach out there before starting significant work, to confirm direction and avoid duplicated effort.

## Development Setup

Follow the [Quick Start](./README.md#quick-start) instructions in the README to get the app running on the iOS Simulator or a physical device. In summary:

```bash
npm install
npm run web:placeholder        # stage a placeholder web bundle (no frontend build needed)
npx cap sync ios               # or: npx cap sync android
npx cap run ios                # or open in Xcode / Android Studio
```

See [`docs/project-structure.md`](./docs/project-structure.md) for a full breakdown of the build pipeline (how the `openframe-frontend` static export becomes `www/`, and how `cap sync` stages it into each native project), and [`docs/run-on-iphone.md`](./docs/run-on-iphone.md) for the physical-device workflow.

## Adding a Native Feature

Every native feature follows the same pattern, documented in [`docs/using-native-apis.md`](./docs/using-native-apis.md):

1. `npm install` the Capacitor plugin (it carries its own native code).
2. `npx cap sync` to wire the native code into the iOS/Android projects.
3. Flip any required capability/entitlement in Xcode or the Android manifest (configuration, not code).
4. Call the plugin's JS API from the frontend, or — for shell-only concerns — from an injected script.

You only need to write Swift/Kotlin/Java directly when no maintained plugin exists for a feature (as with push notification rendering and native file I/O in this repo), or when a maintained plugin has a security gap unacceptable for our use case (as with biometric-gated authentication — see `NativeAuthPlugin` and `SecureTokenStore`).

## Platform Parity

iOS and Android implementations of native plugins are written independently (Swift vs. Java) but must expose **identical JS-callable contracts** so the shared frontend code works unmodified on both platforms. When you change one platform's plugin behavior (e.g. `NativeAuthPlugin`, `TokenLifecycle`, `SecureTokenStore`, `PushNotifications`), check whether the equivalent class on the other platform needs the same change.

## Multi-Environment Awareness

This app ships in `prod`, `stage`, and `dev` variants on both platforms, each with distinct bundle/application IDs, Firebase projects, and OAuth callback schemes. When touching build configuration, authentication, or push notification code, consider whether your change needs to be mirrored across environment-specific configuration (see [`docs/release-ios-stage.md`](./docs/release-ios-stage.md), [`docs/release-ios-prod.md`](./docs/release-ios-prod.md), [`docs/release-android-stage.md`](./docs/release-android-stage.md), and [`docs/release-android-prod.md`](./docs/release-android-prod.md)).

## Pull Request Guidelines

- Keep changes focused — native shell changes (auth, push, file I/O, build pipeline) should be separate from frontend-facing concerns.
- Test on both the iOS Simulator and, where the change touches device-only behavior (push tokens, biometrics, camera), a physical device.
- If your change affects the contract consumed by `openframe-frontend` (e.g. a `NativeAuth` or `NativeFiles` plugin method signature), call this out clearly in the PR description so the frontend side can be updated in lockstep.
- Reference the relevant `docs/` file(s) you updated or relied on.

## Documentation

If you change build pipeline behavior, native plugin contracts, or release processes, update the corresponding file under [`docs/`](./docs/README.md) in the same change. See the [Documentation index](./docs/README.md) for the full list of available guides.
