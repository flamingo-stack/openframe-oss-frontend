# iOS production release (App Store)

Prod is the plain `App` scheme in `Release` — no configuration-name suffix, so
the "Select Firebase config" build phase `exit 0`s and the committed-path
`App/GoogleService-Info.plist` (Firebase project `firebase-94qh`) is what ships.

| | value |
|---|---|
| bundle id | `ai.openframe.mobile` |
| display name | OpenFrame |
| OAuth scheme | `com.openframe.app` |
| Xcode | `App` scheme, `Debug` / `Release` |
| team | `F7LDSU8JPJ` |
| device family | iPhone only (`TARGETED_DEVICE_FAMILY = 1`) |

## Build + export

```sh
NEXT_PUBLIC_SHARED_HOST_URL=https://<prod shared auth host> \
BUILD_NUMBER=<increasing int> \
scripts/build-ios-prod.sh
```

Produces `build/prod/*.ipa` (App Store Connect export, automatic signing).
Upload with Transporter or `xcrun altool --upload-app` (API key), then attach
the build to the App Store version in App Store Connect.

Flags: `SKIP_WEB=1` (reuse the staged bundle — only if *this* lane built it),
`WEB_ONLY=1` (stop after `cap sync`; then run the `App` scheme from Xcode).

The lane refuses to proceed when any of these hold:

- `capacitor.config.ts` still has a live-reload `server.url`
- `ios/App/App/GoogleService-Info.plist` is missing (it's gitignored — without
  the guard the archive would succeed and ship a push-less binary, because the
  Firebase build phase deliberately does nothing for non-suffixed configs)
- the archive's `aps-environment` is not `production`

## One-time setup (manual, outside the repo)

1. **App Store Connect app record** for `ai.openframe.mobile` — full App Store
   listing, not TestFlight-only.
2. **App ID** `ai.openframe.mobile` with the **Push Notifications** capability.
3. **Production APNs `.p8` key** uploaded to the *prod* Firebase iOS app.
   Map it by **bundle id**, never by folder name — exports have arrived with
   prod↔stage swapped.
4. **Gateway**: the prod tenant gateway must allow the `capacitor://localhost`
   origin and **expose** `Access-Token` / `Refresh-Token`, `/content/*`
   included, and the prod shared host must accept
   `redirectTo=com.openframe.app://auth`.

## Submission checklist (App Store Connect)

- **Screenshots** — iPhone only; ASC lists the display sizes it currently
  requires. No iPad set is needed now that the app is iPhone-only.
- **App Privacy questionnaire** — must agree with
  `ios/App/App/PrivacyInfo.xcprivacy`, which currently declares email address,
  name, and user ID as linked, non-tracking, App Functionality. If the
  questionnaire answers differ, fix whichever one is wrong; a mismatch is its
  own problem.
- **Camera and microphone** — `NSCameraUsageDescription` and
  `NSMicrophoneUsageDescription` are in Info.plist because attachment pickers
  offer "Take Photo or Video" (iOS terminates the app on capture without them).
  Reviewers look for a feature behind every declared permission, so the review
  notes must point at attaching a photo to a ticket or KB article. Drop the
  option from both pickers before dropping the keys — never the reverse.
- **Privacy policy URL** and **support URL** — both required.
- **Age rating** questionnaire and primary category.
- **App Review Information** — a demo account on a tenant with an **active
  plan**, plus review notes explaining that this is a B2B MSP console and how
  to reach the main surfaces. Supply a **second, disposable account** for the
  account-deletion test so a reviewer deleting it doesn't strand later passes.
- **Export compliance** — already answered by `ITSAppUsesNonExemptEncryption`
  in Info.plist; no per-build prompt.

## Blocking on the frontend, not here

The shell is submittable long before the bundle it wraps is. Still open in
`openframe-frontend` at the time of writing: Sign in with Apple, in-app account
deletion, and removing every purchase path from the mobile build — note that
route-gating `settings/billing-usage` does **not** remove the paywall, because
`subscription-lock-content.tsx` imports the plan picker directly and
`app-layout.tsx` swaps the whole app for it when a tenant is locked. Full
analysis: vault note `Releases/Mobile App - Store Review Readiness Plan`.

## Gotchas

- App Store Connect rejects re-used build numbers — bump `BUILD_NUMBER` per
  upload. `MARKETING_VERSION` is the user-visible version and only changes per
  release.
- `aps-environment` comes from the per-configuration `APS_ENVIRONMENT` build
  setting, which `App.entitlements` references as `$(APS_ENVIRONMENT)`. Don't
  hardcode it back to `development` — push would silently die in the shipped
  build. The lane asserts this on the archive before exporting.
- Don't change `PRODUCT_NAME` / `TARGET_NAME` to fix a name shown anywhere —
  the SSO consent alert reads `CFBundleName`, which is pinned to `OpenFrame`
  in Info.plist for exactly this reason.
- SPM dependencies build in release mode under the custom configuration names;
  expected, no functional difference.
