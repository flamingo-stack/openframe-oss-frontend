# Shell architecture

How the desktop shell is put together: why it bundles the frontend, how the
bundle is staged and served, how windows behave, and what the security model is.
Auth and notifications have their own document —
[auth-and-notifications.md](./auth-and-notifications.md).

## Why a bundled export

The OpenFrame frontend is a Next.js SSR app: runtime env via `next-runtime-env`,
build-time `rewrites()`, and every backend URL resolved from
`runtimeEnv.tenantHostUrl() || window.location.origin`.

A webview wrapper can only load bundled static files or a remote URL, which for
an SSR frontend leaves three options:

| Shape | Frontend change | Verdict |
|---|---|---|
| Remote-URL shell | none | Works, but the app is a browser pointed at the tenant. Weakest posture for app-store distribution. |
| **Bundled static export** | de-SSR workstream | **Shipped.** A real native app; data goes over the API with token auth, which needs CORS for the shell origin. |
| Bundled SSR server | n/a | Rejected — a Node server cannot run on iOS, and the same shape everywhere is worth more than a desktop-only shortcut. |

The product is useless offline (auth, GraphQL, NATS and MeshCentral all live on
the gateway), so bundling buys nothing in availability. It buys app-store
viability and cold-start time.

## Bundle pipeline

`scripts/build-web.sh` (wrapped by `make web`, aliased `npm run build:web`)
builds the web app in this same repository — installs its dependencies if
missing, runs `OPENFRAME_BUILD_TARGET=export npm run build`, and copies `dist/` to
`www/`. The shell and the bundle always come from one commit.

`release.yml` builds the shell on every dispatch and attaches it, with
`updater.json`, to the same `x.y.z` release as the web image, so a desktop
version is always the web version it bundles. See [Releasing](../README.md#releasing).

`www/` is a generated artifact. `tauri.conf.json` sets `frontendDist: "../www"`,
and `generate_context!` embeds the directory **at compile time** — so `www/` must
exist for `cargo check` to succeed, not just for a bundle. `npm run web:placeholder`
writes a stub for that, and the `predev` hook stages it when missing.

Unlike the mobile shell, there is no build-time env injection step: env is
injected at runtime (below), so one bundle works against any gateway.

## Runtime env injection

Every window hosting bundle content gets a Tauri initialization script
(`env_init_script`), which runs before any page script and supplies what the SSR
server would have:

- `window.__ENV` — `NEXT_PUBLIC_SHARED_HOST_URL`, `NEXT_PUBLIC_APP_MODE`, the
  dev-ticket observer flag, and `NEXT_PUBLIC_GTM_CONTAINER_ID`. This is what
  `next-runtime-env` reads; export builds omit `<PublicEnvScript />`.
  `NEXT_PUBLIC_TENANT_HOST_URL` is deliberately **absent**, so the frontend falls
  through to the tenant host learned at login.

  The GTM id is baked in from `OPENFRAME_GTM_CONTAINER_ID`; GTM is what loads
  PostHog, so a build without it sends no analytics. It is the web app's container.
  Only release builds carry it, and the shell injects it only on the shared host the
  build was made for: one release serves every environment, and an install pointed
  at stage or QA must stay out of production analytics. A tag added to that container
  runs here too: the CSP keeps its remote scripts out, but an inline tag can call the
  shell's commands.

  Events and recordings report the tenant's origin rather than `tauri://localhost`, or
  the shared host when not signed in (`desktop-tenant-urls.ts` in `apps/web`, PostHog's
  `before_send`). `app_platform: desktop` is what tells them from the web's.
- **`window.__OPENFRAME_SHELL__.nativeAuth`** — the auth bridge, backed by the
  `native_auth_*` Tauri commands. Its method names match openframe-mobile's
  `NativeAuthPlugin`, so the frontend keeps one interface with two
  implementations and desktop gets the same treatment as mobile — bearer auth,
  shell-held tokens — with no desktop-specific frontend code.

  This used to be injected as a **fake `window.Capacitor`** whose
  `isNativePlatform()` returned true, because the frontend had a single
  "is this native?" predicate that both shells had to satisfy. The frontend now
  distinguishes all three targets itself (`lib/platform.ts` — web / mobile /
  desktop, detecting us from Tauri's IPC globals), so nothing here impersonates
  Capacitor, and phone-only features (FCM push, biometrics, safe-area insets,
  Android back) can no longer switch on in a desktop window. Renaming or dropping
  this namespace kills desktop sign-in: keep it in sync with `nativeAuthPlugin()`
  in the frontend.

## Hosts

The shell knows exactly one configured URL, the **shared auth host**. There is no
tenant host to configure anywhere.

- Baked at build time from `OPENFRAME_SHARED_HOST_URL` (`option_env!`; `build.rs`
  declares `rerun-if-env-changed` so a changed host actually invalidates the
  cached build). Overridable per install by `shared_host` in `config.json`.
- `config.json` holds `shared_host` and `learned_host` — the tenant origin the
  frontend pushes back after login, used by shell-side networking — alongside the
  updater and start-at-login keys. README's Configuration table is the
  authoritative list.
- Boot always goes straight to the main window. Unauthenticated, the bundle shows
  its own sign-in screen: email → tenant discovery on the shared host → provider
  → native login. The tenant origin is the one discovery resolved — the login
  callback lands on the app's custom scheme and carries no host — and it is
  persisted both in the webview and shell-side.
- Tray **Sign Out** clears tokens and the learned host and recreates the main
  window at the sign-in screen.

Consequence: self-hosted single-tenant instances, which have no shared auth host
to discover against, are out of scope for this shell.

## Windows

- **Routing.** Tauri's asset resolver falls back `path` → `path/index.html` →
  `index.html`, so the export's trailing-slash routes, cold deep links to
  query-param pages, and unknown paths (SPA fallback) all resolve.
- **New windows** (`window.open`, `target="_blank"`). Bundle-origin targets open
  as in-app child windows — cascaded, with the same init script injected.
  Matching is done against a live window's origin rather than a hardcoded one, so
  it is correct across platforms and in dev. External http(s) opens in the system
  browser; that now includes tenant-origin links, since app content no longer
  lives there. Companion-app links (`APP_LINK_SCHEMES`: `openframe-chat://`, Fae's
  "Open Fae") are handed to the OS, which opens the app that claims the scheme.
  Other schemes are blocked.
- **No white flash.** Windows are created hidden with a dark background colour and
  revealed on `PageLoadEvent::Finished`, with a timer as a safety net.
  `background_color` alone is not enough on macOS, where it is not applied to the
  webview layer.
- **Close to tray**, single-instance, and macOS dock/activation-policy handling.
- **Replacement uses `destroy()`, not `close()`** — `close()` emits
  `CloseRequested`, which the close-to-tray handler turns into a hide. Because
  `destroy()` is processed by the event loop after the calling command returns,
  recreating a window under the same label is done from a spawned task; doing it
  inline would either collide on the label or deadlock the event loop.

## Start at login

`src-tauri/src/autostart.rs`. Registration is per-user — a launchd agent at
`~/Library/LaunchAgents/com.openframe.console.plist` on macOS, an `HKCU`
`…\CurrentVersion\Run` value on Windows, a `~/.config/autostart` desktop entry on
Linux — and carries `--autostart`, which is the shell's only signal that a launch
came from the OS rather than the user. That flag (or **Always Start Hidden**,
below) suppresses two things: building the main window, and — on macOS — the
Regular activation policy, which would otherwise leave a dock icon with nothing
behind it. Everything a login start exists for (tray, token refresh, NATS,
notifications) is already wired independently of any window; the tray's
**Show** builds one on demand, and so does a notification click, which would
otherwise do nothing for the life of the process.

`tauri`'s `restart()` re-spawns with the process's own argv, so an update taken
silently at login relaunches still headless. When the user *does* have a window
open, the updater records `autostart_show_window_next_start` in config.json
before installing, and the next launch consumes it and builds one. That is a
durable marker rather than a tweak to the relaunch argv because on Windows the
relaunch is not ours to shape: `download_and_install` hands this process's argv
to the installer (`/ARGS` for NSIS, `LAUNCHAPPARGS` for MSI) and then calls
`std::process::exit(0)`, so nothing after it runs. The marker is written when the
download finishes rather than before it starts, since a download can run for
minutes and the user may open a window during it.

Written by hand rather than with `tauri-plugin-autostart`: the plugin passes
`auto-launch` an unquoted exe path, and this product's install path contains
spaces, so Explorer's `CreateProcessW` prefix search would run a planted
`%LOCALAPPDATA%\OpenFrame.exe` ahead of ours. The plugin also never sets
`AssociatedBundleIdentifiers`, without which the macOS Login Items entry is an
unattributed background item. Both backends are a few lines each over `winreg`
and `write_atomic`, which the crate already has.

- **On by default, applied once.** The first launch registers and records
  `autostart_configured`; later launches never re-apply it, so a user who turns
  it off in the OS's own UI is not fought. What later launches do repair is a
  registration that no longer matches the current binary — the `.app` was moved,
  or reinstalled elsewhere.
- **Debug builds never register at startup.** `current_binary` is
  `target/debug/…`, which the OS never registered — no tray, no notifications, no
  bundle identity. The explicit toggle still works, so the mechanism stays
  testable in dev. (`current_binary`, not `current_exe`: on Linux it resolves the
  real AppImage path instead of the ephemeral `/tmp/.mount_*` mount, which would
  never match at the next launch and so be rewritten forever.)
- **A managed install can pin it** with `autostart_enforced`, which is converged
  on at every launch and greys out the tray item. It cannot beat the OS's own
  switch, and does not try to — see Known gaps.
- **The OS's own switch is read where it can be, and never overwritten by the
  reconcile.** Windows keeps it in `StartupApproved\Run`; GNOME/XFCE/KDE keep
  theirs as `X-GNOME-Autostart-enabled=false` or `Hidden=true` *inside the entry
  the shell wrote*. So on Linux the staleness comparison is an allow-list of the
  keys the shell owns — anything the desktop added, switch or otherwise, is
  ignored rather than read as a stale file — and a genuine repair copies those
  switch lines across. Only an explicit toggle clears either.
- **Surfaces**: the tray's *Start at Login* check item, and the
  `autostart_status` / `autostart_set` commands for the frontend. Both go through
  the same state, so either moves the same check mark. No web code calls the
  commands yet, so `capabilities/main.json` does not grant them; a settings toggle
  has to add `allow-autostart-status` and `allow-autostart-set` there.
- **Always Start Hidden** (tray check item, `start_hidden` in config.json) makes
  every cold start headless, not only a flagged one. The flag marks only the
  launches our own registration makes; a login item the user added by hand, an
  MDM or startup-folder script, or the OS restoring the session start the app
  without it, and from inside the process they are indistinguishable from the
  user opening it. So the setting covers a manual launch too — the tray icon, a
  notification click or a second launch brings the window up. Two things still
  win over it: an update's `autostart_show_window_next_start`, and on Windows a
  toast click that cold-started the app, whose payload setup has just stashed
  for a window only setup builds. When the hidden copy started first and our
  registration starts a second one, the single-instance plugin forwards that
  launch's `--autostart`, and a forwarded flag raises nothing. The opposite
  order is not covered — see Known gaps.

## Local agent install

"Deploy on this Device" on the setup wizard's Deploy First Device screen
(`src-tauri/src/installer.rs`, command `agent_install_start`). The shell adds the
two things a browser tab cannot - an elevation prompt and a place to run the
install - and it writes the command itself.

- **The page sends values, never a command.** `{ orgId, initialKey, logKey?,
  userId? }`, each held to the characters the backend issues them in (letters,
  digits, `-`, `_`, no leading `-`), with unknown fields refused. The host comes
  from the shell's own `learned_host`, held to the tenant rule below, and the
  download's machine id is a UUID the shell generates. The result is the text the
  wizard offers to copy: `src-tauri/src/install-command.json` holds the expected
  command for both platforms, and a Rust test and a web test both compare against
  it, so changing `buildInstallCommand` fails until the shell changes too.
- **A native dialog comes first, and it is the check on enrolment.** A script in
  the page can still sign in to a workspace of its own and start this install, and
  the agent it gets is the real one, so an approved install hands that workspace
  remote control of the machine. Before anything is written or elevated, the shell
  shows its own dialog (`rfd`: `NSAlert` on macOS, `MessageBoxW` on Windows) naming
  the tenant host it resolved. Nothing in the webview can draw or answer it. Anything
  but OK ends the run as `cancelled`, the same as a declined admin prompt, and a
  window hidden to the tray cannot raise it at all. It relies on the person reading
  the host: a script can still raise it again and again from a visible window.
- **Elevation is the OS's own prompt**, never a password of ours: `osascript …
  with administrator privileges` on macOS, `Start-Process -Verb RunAs` (UAC) on
  Windows. A declined prompt ends the run as `cancelled`. The macOS prompt names the
  tenant host too; UAC has no room for text of ours.
- **The command runs from a per-run temp directory** (`openframe-install-<uuid>`
  under the user's temp dir, `0700` on macOS): the command as a script, a runner
  script the elevated process executes, `install.log` and `status`. The command
  carries the workspace's registration secret, so the directory is readable by
  this user only and removed when the run ends, however it ends.
- **Output is tailed, not piped.** An elevated process's stdio is not ours to
  read, so the runner redirects everything into `install.log` and a thread polls
  it every 200 ms, emitting whole lines as `agent-install:output` to the main
  window; `agent-install:done` carries the exit code the runner wrote to `status`
  (zero = success), or the error when the command never ran.
- **One run at a time** (`InstallerState`): a second start while one is running
  is refused as `busy` rather than raising a second prompt.
- Linux has no elevation path here and answers `unsupported`; the UI never
  offers the button outside the desktop shell.

## Security model

The threat this section is written against is a script running in the document:
an XSS, or a third-party tag, and the webview's CSP admits both GTM and inline
script on purpose (PostHog runs through GTM's Custom HTML tags). Such a script runs
with the document's origin (`tauri://localhost`), so nothing here can tell it from
our own code. Assume one runs. What protects the machine and the session is what the
shell itself refuses.

**What an inline tag can still do:**

- Read the access token, use it, and send it anywhere until it expires, and through
  it anything the user can reach, including the registration secret.
- Start the enrolment described under [Local agent install](#local-agent-install).
  The native dialog is the check on that, and it depends on the person reading it.
- Take the refresh token by redeeming a sign-in ticket itself. `start` hands the page
  the callback URL with its `devTicket`, signup hands it one in a response body, and
  the gateway exposes `Refresh-Token` to these origins, so a script that catches a
  ticket can fetch `/oauth/dev-exchange` and read the header. Reasoned from the code
  and the gateway config, not run. Closing it takes the gateway no longer exposing
  that header, and moving the sign-ins the page runs itself
  (`storeTokensFromHeaders`) into the shell.

**What it cannot do:** run a command of its own through the admin prompt, get the
refresh token through the bridge, point the shell at a host outside the shared host's
zone, or call a command the capability does not grant.

- **CSP.** `tauri.conf.json`. It limits which remote hosts can serve a `<script
  src>` (`www.googletagmanager.com`, `us-assets.i.posthog.com`) and blocks `eval`.
  **It does not stop injected code.** `script-src` has `'unsafe-inline'`, which GTM's
  Custom HTML tags need, so an injected inline script runs, and since `connect-src`
  takes any `https:` it can fetch code from any host and run that inline too. The
  allowlist keeps a Meta or Reddit tag added to the container from loading its
  remote script. It is not a boundary against a script already running.
  - Tauri's asset modification is off for `script-src` and `style-src`
    (`dangerousDisableAssetCspModification`). A hash or a nonce in a directive makes
    browsers ignore `'unsafe-inline'` there, and Tauri would add both. With hashes on,
    every inline script of the export but the ones it hashed is blocked; a test holds
    this setting in place.
  - No `'unsafe-eval'`, and no bare `https:` in `script-src`. A new remote script
    host has to be added here on purpose, in `csp` and `devCsp`.
  - `connect-src`, `img-src`, `media-src` and `frame-src` take any `https:`, since
    tenants, presigned storage URLs, Mux and embeds are not a list this shell can know
    at build time. A script that runs can send what it can read anywhere.
  - `devCsp` is the same plus loopback, for a gateway on the developer's own box. A
    release build has no loopback source, so a local gateway needs `npm run dev`.
- **Capabilities and the ACL.** `build.rs` declares every app command, which is
  what puts them under the ACL, and `capabilities/main.json` (scoped to `main` and
  `child-*`) grants exactly what `apps/web` and `env_init_script` call: a new
  command is refused until it is listed in both, and a test checks the first.
  `core:default` and `updater:default` are not granted (the updater runs from Rust),
  nor are `autostart_status` / `autostart_set`, which no web code calls yet; the
  tray reaches the same state from Rust. A remote document gets no IPC, since no
  capability sets `remote`.
  There is one capability rather than a narrower one for `child-*`, because on
  macOS a child window is built on its opener's webview configuration and its
  `invoke` arrives labelled `main`. Commands that are main-only say so in Rust
  (`agent_install_start` and `update_apply_now`, for example), which is only as good
  as that label.
  `withGlobalTauri` stays on: `__TAURI_INTERNALS__` exists regardless, so turning it
  off would hide nothing from a script.
  `core:window:allow-maximize` is there because sign-in, registration and the setup
  wizard are drawn for a full screen, and the window is maximized from the first of
  them.
- **The bridge does not give the page the refresh token.** See
  [NativeAuth surface](./auth-and-notifications.md#nativeauth-surface), and the ticket
  path above for the way around it. The access token is unavoidable, since every
  request from the page carries it, so a script that runs can act as the user until
  it expires.
- **A tenant host is checked, not taken.** `native_auth_set_tenant_host` takes a
  bare `https` origin under the shared host (`tenant_origin` in `lib.rs`), the
  zone the backend issues tenants in, and its labels are only lowercase letters,
  digits, `-` and `_`, because the install command is written from it. The shell
  sends the bearer to that host, reads the updater manifest from it, and installs the
  agent from it. A script can still name another real tenant, though not an arbitrary server, which is why the install
  dialog names the host.
- **Gateway CORS is a prerequisite.** The gateway must allow `tauri://localhost`
  (macOS/Linux) and `http://tauri.localhost` (Windows), and expose the
  `Access-Token`/`Refresh-Token` headers (the ticket path above is what exposing the
  second one costs). Without it the bundle renders and every data call fails.
- **Dev shares the production origin.** `npm run dev` passes `--no-dev-server`, so
  dev serves the bundle from disk over the same `tauri://localhost` protocol
  rather than the CLI's static server on `http://127.0.0.1`, whose origin would
  need its own CORS entry.

## Debugging

Release builds ship without devtools. `env_init_script` forwards the webview's
`console.error`, uncaught errors and unhandled rejections into the shell log, and
logs a boot marker with the injected `window.__ENV` and the page origin.

| OS | Log |
|---|---|
| macOS | `~/Library/Logs/com.openframe.console/openframe-console.log` |
| Windows | `%LOCALAPPDATA%\com.openframe.console\logs\openframe-console.log` |
| Linux | `~/.local/share/com.openframe.console/logs/openframe-console.log` |

## Known gaps

- Tokens are stored as plaintext in an owner-readable file. Keychain/Credential
  Manager storage is not implemented.
- This document has no section on the updater (`src-tauri/src/updater.rs`), which
  runs a silent startup check, a 45-minute poll, and the `update_check` /
  `update_apply_now` commands behind the UI's update modal.
- Linux has no OS-notification backend, and neither do unbundled macOS dev builds
  (the notification APIs require a bundle identifier). Windows dev builds do,
  including the action buttons — the shell registers its own AUMID and toast
  activator under `HKCU` rather than depending on the installer.
- CI signing and notarization are out of scope for this repo's build tooling; they
  run against the produced artifact.
- **A user can overrule a pinned start-at-login policy, and the shell reports
  that rather than fighting it.** Windows keeps its own switch in
  `StartupApproved\Run` (Task Manager → Startup) and macOS keeps one in a
  background-item database with no public API, so `autostart_enforced: true` can
  coexist with the app not starting. `autostart_status` returns
  `enabled: false, enforced: true` for exactly that case, and it is logged at
  startup. Re-enabling ourselves in `StartupApproved` would enforce it on Windows
  only, and is textbook malware behaviour; it is deliberately not done.
- **On macOS the reported state means *registered*, not *will run*** — the
  background-item database is unreadable, so a disable made in System Settings is
  invisible to the shell. Windows and Linux have no such gap: their switches
  (`StartupApproved\Run`, and `Hidden` / `X-GNOME-Autostart-enabled` in the entry
  itself) are both readable and are read.
- **Neither uninstaller removes the registration.** Both the Run value and the
  plist are written at runtime. On Windows the leftover is a silent no-op; on
  macOS launchd logs a failure each login. Windows could be fixed with an NSIS
  uninstall hook; macOS has no uninstaller to hook.
- **Always Start Hidden cannot hold back a flagless launch that reaches a
  running copy.** When our registration's copy starts first and a login item
  added by hand starts second, the second arrives as a forwarded launch without
  the flag (Windows) or as a `RunEvent::Reopen` (macOS: a Login Items entry or a
  session restore reopening the launchd copy). Both are exactly what the user
  opening the app looks like, so the window comes up. On Windows this is the
  usual order for a Startup-folder entry, which Explorer generally starts after
  the Run keys. A hand-added entry should replace **Start at Login**, not sit
  beside it.
