# Run a dev build on a real iPhone

How to get the OpenFrame mobile shell running on a physical iPhone from this repo.
Capacitor 8 uses **Swift Package Manager**, so **CocoaPods is NOT required** — you
only need full Xcode.

---

## Prerequisites (one-time)

1. **Full Xcode** (from the Mac App Store) — *not* just the Command Line Tools.
   > This machine currently has only Command Line Tools. After installing Xcode:
   > ```bash
   > sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   > sudo xcodebuild -runFirstLaunch
   > xcodebuild -version   # should now print a version
   > ```
2. **Node 18+** (already present) and `npm install` in this repo.
3. An **Apple ID** added to Xcode (Xcode → Settings → Accounts → +). A **free**
   Apple ID works for running on *your own* device — apps re-sign every **7 days**.
   The **paid Apple Developer Program** ($99/yr) is needed for push notifications,
   longer provisioning, TestFlight, and distribution (see `mobile-app-plan.md` §7).
4. An **iPhone**, a **USB cable**, and (iOS 16+) **Developer Mode** enabled:
   Settings → Privacy & Security → **Developer Mode** → On → restart.
5. *(No CocoaPods.)* Xcode resolves the Capacitor Swift packages automatically.

> The **Simulator** needs only prerequisites 1–2 + 5 (full Xcode + Node). The Apple ID,
> signing, device, and Developer Mode (3–4) are required only for a **physical iPhone**.

---

## Quickest: iOS Simulator (no device or Apple account)

The iOS Simulator ships with Xcode — no Apple ID, signing, provisioning, or Developer
Mode. Best path for building out UI and most data flows.

```bash
npm install
npm run web:placeholder        # or: npm run build:web   (real frontend export)
npx cap sync ios
npx cap run ios                # choose an iPhone simulator from the list
# — or — npx cap open ios, pick a simulator in the toolbar, press ▶ Run
```

**Works** in the Simulator: full UI / routing; GraphQL/REST/NATS/MeshCentral over the
Mac's network (the `capacitor://localhost` origin still applies, so gateway **CORS**
must allow it); **biometrics** — simulate via Simulator → Features → Face ID →
*Enrolled*, then trigger *Matching / Non-matching Face*.

**Needs a physical iPhone** (don't work in the Simulator):
- **Push (APNS):** no real device token / no end-to-end remote push. You can inject a
  local payload only: `xcrun simctl push booted ai.openframe.mobile payload.apns`.
- **Camera / QR scan:** no camera hardware (the photo *picker* works with sample images).

---

## On a physical iPhone

```bash
# 1. install JS deps
npm install

# 2. stage a web bundle into www/  (pick ONE)
npm run web:placeholder                       # dev stub — proves the device pipeline
# — or — the real openframe-frontend export:
FRONTEND_DIR=~/flamingo/openframe-frontend \
NEXT_PUBLIC_TENANT_HOST_URL=https://<your-tenant> \
  npm run build:web

# 3. sync the bundle + native deps into the iOS project
npx cap sync ios

# 4. open in Xcode
npx cap open ios
```
> `ios/` is already committed (`cap add ios` was run during scaffolding), so you do
> **not** re-run `cap add ios`. Just `cap sync` after each web build.

### In Xcode
1. First open: Xcode resolves Swift packages (wait for "Package resolution" to finish).
2. Select the **App** target → **Signing & Capabilities**:
   - check **Automatically manage signing**;
   - **Team** → your Apple ID team;
   - if the bundle id `ai.openframe.mobile` is already taken on your account,
     change it to something unique (e.g. `ai.openframe.mobile.dev`).
3. Plug in the iPhone; on the phone tap **Trust This Computer**.
4. Pick your iPhone in the run-destination dropdown (top toolbar) → press **▶ Run**.
5. First install only — on the phone: Settings → General → **VPN & Device Management**
   → under *Developer App* tap your Apple ID → **Trust**. Re-run from Xcode.

The placeholder bundle shows **"✓ Native shell is running on this device."** The real
bundle boots straight into OpenFrame (it needs `NEXT_PUBLIC_TENANT_HOST_URL` injected
at build — step 2 — and the gateway must allow the `capacitor://localhost` origin via
CORS; see `mobile-app-plan.md` §4).

---

## Live-reload dev loop (optional, fastest iteration)

Instead of bundling, point the app at openframe-frontend running on your Mac so edits
hot-reload on the device:

```bash
# on the Mac, in the frontend repo:
npm run dev                       # serves on :3000
ipconfig getifaddr en0            # your Mac's LAN IP, e.g. 192.168.1.50
```
Uncomment `server` in `capacitor.config.ts` with that IP:
```ts
server: { url: 'http://192.168.1.50:3000', cleartext: true },
```
Then `npx cap sync ios` and Run. The phone and Mac must be on the same Wi‑Fi.
**Remove `server` before building anything you ship.**

After a first cabled run you can go wireless: Xcode → Window → **Devices and
Simulators** → select the device → **Connect via network**.

---

## Pointing the bundle at a gateway (env vars)

The static bundle has no server, so gateway config is injected into `window.__ENV` at
**build time** by `build:web`. Pass the vars to that command — they flow both into the
frontend export build (`process.env`, so build-time renders match) and into
`window.__ENV` (what the client reads at runtime):

```bash
NEXT_PUBLIC_SHARED_HOST_URL=https://openframe.miami \
NEXT_PUBLIC_APP_MODE=saas-tenant \
NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER=true \
  npm run build:web
npx cap open ios            # or: npx cap run ios
```

The bundle is tenant-agnostic: sign-in starts with email → tenant discovery on the
shared host, and the shell learns the tenant host from the OAuth callback (persisted
across launches). Add `NEXT_PUBLIC_TENANT_HOST_URL=https://test-stage.openframe.miami`
to pin a single tenant — required against gateways whose `/sas/tenant/discover` does
not yet return the tenant `domain`.

**Re-run `build:web` whenever the vars change**, then re-run in Xcode (they're baked in,
not read at launch).

**For live data + auth to work**, the tenant gateway must allow the bundle's origin
`capacitor://localhost` via **CORS** (Flamingo test-dev and prod gateways: already
configured; self-hosted gateways need it added), and auth uses the **Bearer/dev-ticket** path
(`NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER=true`) since cookies don't survive cross-origin
from `localhost`. Until the gateway allows that origin you'll see **CORS / 401** errors —
the shell renders but data calls fail. Inspect with **Safari → Develop → [your Simulator
or device] → the WebView** (console + network). See `mobile-app-plan.md` §4 (items A–C).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `xcodebuild requires Xcode` / only Command Line Tools | Install full Xcode, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| "Could not launch — Developer Mode disabled" | Enable Developer Mode (Prereq 4), restart phone |
| "Untrusted Developer" on launch | Trust the cert: Settings → General → VPN & Device Management → Trust |
| Signing: "No profiles for 'ai.openframe.mobile'" | Select a Team + Automatic signing; change the bundle id if it's taken |
| App stops launching after ~a week | Free Apple ID certs expire in 7 days — re-run from Xcode, or join the paid program |
| Swift package resolution stuck/failing | Xcode → File → Packages → **Reset Package Caches**; or delete `~/Library/Developer/Xcode/DerivedData` |
| Blank screen with the real bundle | `NEXT_PUBLIC_TENANT_HOST_URL` not injected, or gateway CORS rejects `capacitor://localhost` (mobile-app-plan.md §4) |
| Push notifications don't work | Requires the **paid** program + APNs key + Push capability — out of scope for a dev run |
