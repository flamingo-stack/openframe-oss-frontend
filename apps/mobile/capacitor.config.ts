import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.openframe.mobile',
  appName: 'OpenFrame',
  // The static web bundle Capacitor ships inside the app. Populated by
  // `npm run web:placeholder` (dev stub) or `npm run build:web` (real
  // openframe-frontend export). Git-ignored — it is a build artifact.
  webDir: 'www',
  // Shows through during load and in the safe-area bands (viewport-fit=cover
  // + the frontend's shell-scoped safe-area CSS handle the rest). Matches the
  // ODS background (--ods-system-greys-background).
  backgroundColor: '#161616',
  ios: {
    // The shell owns UNUserNotificationCenter's delegate (NotificationActions.swift:
    // Approve/Reject and inline Reply complete natively). Off, Capacitor's
    // NotificationRouter never claims the delegate; the shell forwards every
    // response it does not consume to the Firebase plugin's handler itself, so
    // taps still reach the web view and `presentationOptions` below still applies.
    handleApplicationNotifications: false,
  },
  plugins: {
    // iOS-only: suppress foreground push banners (plugin default is
    // badge+sound+alert). Matches Android, where FCM never auto-displays
    // notification-messages while the app is foregrounded. The plugin still
    // emits notificationReceived in the foreground for in-app handling.
    FirebaseMessaging: {
      presentationOptions: [],
    },
    // `resize` is an iOS-only knob, and 'none' makes both platforms behave the
    // same: the WebView is never resized, and the keyboard height reaches CSS
    // only as `--of-keyboard-inset`, published from the plugin's
    // keyboardWillShow/Hide events by the frontend's keyboard-inset.ts.
    // Android has no resize option at all — it only emits those events — so
    // any other value would leave the two platforms on different mechanisms.
    // 'native' would also shrink the WKWebView out from under the safe-area
    // insets this app publishes from UIKit, floating the home-indicator band
    // above the keyboard. Leave resizeOnFullScreen off for the same reason:
    // it exists to make Android resize, which is exactly what we avoid.
    Keyboard: {
      resize: 'none',
    },
    // launchAutoHide:false keeps the splash up until the frontend calls
    // SplashScreen.hide() (NativeShellInitializer, after token hydration
    // settles — so it also covers a biometric unlock prompt). backgroundColor
    // matches the ODS bg so there's no color flash native-splash -> WebView.
    // The status bar is configured at runtime in the frontend (native-shell.ts).
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#161616',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  // @capacitor-firebase/messaging pulls the Firebase iOS SDK via SPM; this
  // symlink option avoids a SwiftPM package-identity collision (capawesome #959).
  // Requires @capacitor/cli 8.4.0+.
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
  // ─── DEV live-reload (optional) ────────────────────────────────────────────
  // Point at openframe-frontend running on your Mac so edits hot-reload on the
  // device. Find your Mac's LAN IP (`ipconfig getifaddr en0`), run the frontend
  // (`npm run dev`), then uncomment, `npx cap sync ios`, and Run from Xcode.
  // REMOVE before building a shippable (bundled) app.
  //
  // server: {
  //   url: 'http://192.168.1.50:3000',
  //   cleartext: true,
  // },
};

export default config;
