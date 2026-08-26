# iOS stage release (TestFlight internal testing)

The stage app is a separate iOS identity that installs side by side with prod:

| | prod | stage |
|---|---|---|
| bundle id | `ai.openframe.mobile` | `ai.openframe.mobile.stage` |
| display name | OpenFrame | OF Stage |
| OAuth scheme | `com.openframe.app` | `com.openframe.app.stage` |
| Firebase config | `App/GoogleService-Info.plist` | `App/GoogleServices/stage/…` (swapped in by the "Select Firebase config" build phase) |
| Xcode | `App` scheme, Debug/Release | `App Stage` scheme, Debug-stage/Release-stage |

All of it is driven by two build settings on the stage configurations
(`OPENFRAME_DISPLAY_NAME`, `OPENFRAME_URL_SCHEME` — consumed by Info.plist) plus
`PRODUCT_BUNDLE_IDENTIFIER`. The web bundle must be baked with the matching
scheme: `NEXT_PUBLIC_MOBILE_APP_SCHEME=com.openframe.app.stage` (injected into
`window.__ENV`; the frontend reads it via `runtimeEnv.appScheme()`).
A mismatch between the baked scheme and the native registration breaks login.

## Build + export

```sh
NEXT_PUBLIC_SHARED_HOST_URL=https://<stage shared auth host> \
BUILD_NUMBER=<increasing int> \
scripts/build-ios-stage.sh
```

Produces `build/stage/*.ipa` (App Store Connect export, automatic signing).
Upload with the Transporter app or `xcrun altool --upload-app` (API key). Then
App Store Connect → TestFlight → add the build to the internal group.

## One-time setup (manual, outside the repo)

1. **App Store Connect app record** for `ai.openframe.mobile.stage`
   (TestFlight-only — it never needs an App Store release).
2. **App ID** `ai.openframe.mobile.stage` with the **Push Notifications**
   capability (first `-allowProvisioningUpdates` archive from a signed-in
   Xcode can auto-register it).
3. **APNs `.p8` key** uploaded to the *stage* Firebase iOS app
   (`ai.openframe.mobile.stage` — the plists are mapped by bundle id).
4. **Internal testers**: App Store Connect → Users and Access (any role) →
   TestFlight internal group. Up to 100; builds go live minutes after upload,
   no review.
5. **Gateway**: the stage shared host must accept
   `redirectTo=com.openframe.app.stage://auth` on the dev-ticket login path,
   and the stage tenant gateway needs the `capacitor://localhost` CORS setup
   (same as prod — see CLAUDE.md).

## Gotchas

- TestFlight rejects re-used build numbers — bump `BUILD_NUMBER` per upload.
- The `Select Firebase config` phase **fails the build** if
  `App/GoogleServices/stage/GoogleService-Info.plist` is missing (per-env
  configs are gitignored, supplied out-of-band).
- Never hand-edit `Debug-stage`/`Release-stage` name mappings alone — the
  plist-swap phase keys off the `*-stage` configuration-name suffix.
- SPM dependencies build in release mode under the custom configuration names;
  that's expected (slower stage Debug builds, no functional difference).
