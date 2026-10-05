# Using a native API (example: push notifications)

**You write TypeScript, not Swift/Kotlin.** The pattern for every native feature is the
same:

1. `npm install` the plugin (it carries its own native code).
2. `npx cap sync` (wires that native code into the iOS/Android projects).
3. Flip any required **capability/entitlement** in Xcode (config, not code).
4. Call the plugin's **JS API** from your app.

You only ever write Swift/Kotlin if a feature has no plugin (then you author a small
custom plugin) — the case for push and camera. **Biometric login + token storage are the
exception:** they're hand-rolled in the `NativeAuth` plugin (access-control-bound Keychain
/ Keystore), because the maintained biometric plugins do the insecure "boolean gate"
(`authenticate()` → `true` → read an *unprotected* token) instead of binding the token to
the biometric at the OS layer. See vault *Mobile Auth - Token Storage, Biometrics, Passkeys*.

---

## Worked example — push notifications

> **Status:** this integration is now real. Steps 1–2 are done in this repo
> (plugin installed; entitlement + background mode + AppDelegate forwarding wired),
> and the production JS lives in the frontend: `src/lib/native-push.ts`
> (post-login init, token `PUT /api/users/me/push-tokens`, tap → router deep-link,
> logout dereg). The example below remains as the generic pattern for the *next* plugin.

### 1. Install + sync
```bash
npm install @capacitor/push-notifications
npx cap sync ios
```

### 2. iOS capability (Xcode, one-time — this is the only "native" step, and it's config)
App target → **Signing & Capabilities** → **+ Capability**:
- **Push Notifications** (adds the `aps-environment` entitlement),
- **Background Modes** → check **Remote notifications**.

> Real APNS tokens need the **paid** Apple Developer Program and a physical device. The
> Simulator can't get a token, but `simctl push` + the tap handler below still work
> there (see `npm run push:demo`).

### 3. The code — all TypeScript
```ts
// src/native/push.ts  (canonical Capacitor usage — typed)
import { PushNotifications } from '@capacitor/push-notifications';

export async function initPush(navigate: (route: string) => void) {
  // ask permission (shows the iOS prompt)
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;

  // register with APNS (iOS) / FCM (Android) → fires 'registration' with the token
  await PushNotifications.register();

  // device token → hand to the backend so it can target this device
  PushNotifications.addListener('registration', ({ value: token }) => {
    fetch(`${(window as any).__ENV.NEXT_PUBLIC_TENANT_HOST_URL}/api/devices/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('of_access_token') ?? ''}`,
      },
      body: JSON.stringify({ token, platform: 'ios' }),
    });
  });

  PushNotifications.addListener('registrationError', (e) => console.error('push reg error', e));

  // notification arrives while the app is FOREGROUNDED
  PushNotifications.addListener('pushNotificationReceived', (n) => {
    console.log('received', n.title, n.body);
  });

  // user TAPPED the notification → deep-link to the payload's route
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const route = (notification.data as any)?.route; // the "route" key in our payload
    if (route) navigate(route);
  });
}
```
Call it once when the app is ready: `initPush((r) => router.push(r))`.

That is the *entire* push integration — no Swift. The plugin's native code handles the
APNS handshake; Capacitor's app-delegate proxy forwards the system callbacks to it.

### 4. Where this code goes in our architecture
The plugin's JS must run inside the WebView. Two placements:

- **In the frontend** (cleanest, typed): add `src/native/push.ts` to `openframe-frontend`
  and call `initPush` after login. Best when you want the client router to handle the
  deep-link (smooth, no reload).
- **Shell-side, frontend untouched** (matches the "thin shell" goal): native plugins are
  reachable via the global `window.Capacitor.Plugins`, so you can run the same logic from
  a script **injected into `www/index.html`** (exactly like `window.__ENV`) — no bundling,
  no frontend edit, no types:

  ```js
  // scripts/push-bootstrap.js  — injected after the bundle; runs in the WebView
  (async () => {
    const PN = window.Capacitor?.Plugins?.PushNotifications;
    if (!PN) return;                              // web build / plugin absent → no-op
    const perm = await PN.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PN.register();
    PN.addListener('registration', ({ value }) => {/* POST token to backend */});
    PN.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const route = notification?.data?.route;
      if (route) location.assign(route);          // query-param routes resolve to a file
    });
  })();
  ```
  Wire it in like `inject-env.mjs` does (append a `<script src="push-bootstrap.js">` to
  `www/index.html` during `build:web`).

### 5. Test it on the simulator
```bash
npm run push:demo        # xcrun simctl push … dev/push-sample.apns
```
The sample payload carries `"route": "/devices/details?id=demo-device-123"`, so **tapping
the banner** fires `pushNotificationActionPerformed` and navigates there. (The
`registration` listener won't fire on the Simulator — token delivery is device-only.)

---

## The same pattern for other features

| Feature | Install | Capability/config | JS you call |
|---|---|---|---|
| Camera | `@capacitor/camera` | `Info.plist`: `NSCameraUsageDescription` | `Camera.getPhoto()` |
| Biometrics | *(none — hand-rolled in `NativeAuth`; see note above)* | `Info.plist`: `NSFaceIDUsageDescription` | `NativeAuth.enableBiometricLogin()` / `getTokens()` (prompts when gated) |
| Secure storage | `@aparajita/capacitor-secure-storage` | — | `SecureStorage.set/get()` |
| Deep links | `@capacitor/app` | Associated Domains (Universal Links) | `App.addListener('appUrlOpen', …)` |

Same four steps every time: install → sync → (maybe) a config toggle → call from TS.
