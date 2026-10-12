## Prerequisites

This page lists what you need installed and configured before working with the **OpenFrame OSS Frontend** repository (`flamingo-stack/openframe-oss-frontend`). The repository is a monorepo-style **app** that ships three closely related surfaces from one codebase:

- **`apps/web`** — the primary Next.js (App Router) web application, published as the `openframe-frontend` package.
- **`apps/desktop`** — a Tauri shell (`openframe-console`, cargo package `openframe_console`, the artifact this repository publishes) that embeds the web app's static export.
- **`apps/mobile`** — a Capacitor shell (`openframe-mobile`) that wraps the same static export for iOS/Android.

Depending on which surface you intend to build, you will need a different subset of the tooling below. All three share the same Node.js toolchain and the same upstream UI library dependency.

> For how these pieces fit the wider OpenFrame platform (API services, gateway, auth), see [`../reference/architecture/README.md`](../reference/architecture/README.md) and the frontend-core reference at [`../reference/architecture/frontend-core/frontend-core.md`](../reference/architecture/frontend-core/frontend-core.md).

---

### Required software and versions

| Tool | Required version | Where it's pinned | Needed for |
|---|---|---|---|
| Node.js | `24` | `.nvmrc` (repo root) | All surfaces (`apps/web`, `apps/mobile`, `apps/desktop`) |
| npm | `>=11.11.0` | `devEngines.packageManager` in `apps/web/package.json`, `apps/mobile/package.json`, `apps/desktop/package.json` | All surfaces |
| TypeScript | `5.9.3` | `apps/web/package.json` devDependencies | Web app type-checking |
| Next.js | `16.3.6` | `apps/web/package.json` dependencies | Web app |
| React | `19.2.4` | `apps/web/package.json` dependencies | Web app |
| Rust toolchain (edition 2021) | `rust-version = "1.77.2"` | `apps/desktop/src-tauri/Cargo.toml` | Desktop shell only |
| Tauri CLI | `^2.1.0` | `apps/desktop/package.json` devDependencies (`@tauri-apps/cli`) | Desktop shell only |
| Capacitor CLI | `^8.4.3` | `apps/mobile/package.json` devDependencies (`@capacitor/cli`) | Mobile shell only |
| Docker (BuildKit) | any recent version supporting `syntax=docker/dockerfile:1.7` | `apps/web/Dockerfile` | Containerized web build |
| `node:24.21.0-alpine3.24` base image | pinned | `apps/web/Dockerfile` | Containerized web build |

> The root `.nvmrc` pins Node major version `24` for the whole repository — CI and local machines are expected to read this same file, and the Dockerfile's base image major version is kept in lockstep with it.

For the **desktop shell** specifically, `apps/desktop/src-tauri/Cargo.toml` also declares platform-conditional Rust dependencies (Windows: the `windows`/`windows-core`/`winreg` crates for toast notifications; macOS: `objc2`/`objc2-app-kit`/`objc2-user-notifications` for `UNUserNotificationCenter` integration). You only need the matching OS toolchain (Xcode command-line tools on macOS, MSVC/Windows SDK on Windows) if you intend to build or test those code paths.

For the **mobile shell**, Android builds additionally require a JDK compatible with Android Gradle Plugin `9.2.1` (see `apps/mobile/android/build.gradle`) and Android Studio (the build scripts reference its bundled JBR at a fixed path). iOS builds require Xcode and `xcodebuild`.

---

### System requirements

- **OS for web development:** Linux, macOS, or Windows (via WSL recommended) — the web app itself has no OS-specific build step.
- **OS for desktop builds:** macOS, Windows, or Linux, matching the target you compile for (`TARGET` in `apps/desktop/Makefile`). macOS is required to produce the private-API fullscreen behavior described in `apps/desktop/src-tauri/Cargo.toml` (`macos-private-api` feature).
- **OS for mobile builds:** macOS is required for iOS builds (Xcode-only toolchain); Android builds can run on macOS/Linux/Windows but the repository's helper scripts (e.g. `apps/mobile/scripts/build-android-stage.sh`) assume a macOS path to Android Studio's JBR.
- **Disk space:** Node modules, Rust target directories, and Android/iOS build artifacts are large; budget several GB free, particularly for the Tauri `src-tauri` target and Android Gradle caches.
- **Memory:** The web app's Turbopack dev server config in `apps/web/next.config.mjs` caps itself at 8 GiB (`turbopackMemoryLimit`) during `next dev`; ensure the build machine has at least that much available for comfortable local development.

---

### Account / access requirements

- **GitHub access** to `flamingo-stack/openframe-oss-frontend` (clone/push rights as appropriate) and to `flamingo-stack/openframe-oss-lib`, since the web app depends on a package published from that repository (`@flamingo-stack/openframe-frontend-core`, resolved via `pkg.pr.new`, see `apps/web/package.json`).
- **npm registry access** for the pinned npm dependencies listed in `apps/web/package.json`, `apps/mobile/package.json`, and `apps/desktop/package.json`.
- **Cargo/crates.io access** for the Rust dependencies in `apps/desktop/src-tauri/Cargo.toml`, plus Git access to `https://github.com/flamingo-stack/nats.rs.git` (the `async-nats` dependency is pulled directly from this fork's `main` branch, not from crates.io).
- **Container registry access** (`ghcr.io/flamingo-stack/openframe-oss-frontend/openframe-oss-frontend`) if you need to pull or inspect CI-built images; this is the delivery target of the repository's `release.yml` and `test.yml` GitHub Actions workflows.
- **Firebase project access** is only needed for mobile push-notification work: the Android build scripts (e.g. `apps/mobile/scripts/build-android-dev.sh`, `build-android-stage.sh`) require a `google-services.json` placed under the relevant flavor's source set (`android/app/src/{prod,stage,dev}/google-services.json`), and Firebase App Distribution requires `firebase login` via the `firebase-tools` CLI.
- **Code signing credentials** (desktop and mobile release builds only): Android release signing needs the `ANDROID_UPLOAD_STORE_FILE` / `ANDROID_UPLOAD_STORE_PASSWORD` / `ANDROID_UPLOAD_KEY_ALIAS` / `ANDROID_UPLOAD_KEY_PASSWORD` keystore values (see `apps/mobile/android/app/build.gradle`); Tauri auto-update artifacts need `TAURI_SIGNING_PRIVATE_KEY` (see `apps/desktop/Makefile`). These are supplied out-of-band and are not committed to the repository.
- **OpenMSP Slack community access** (https://www.openmsp.ai/, invite at https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA) is where project discussion happens — this repository does not use GitHub Issues or GitHub Discussions.

---

### Environment variables needed

The web app's variables are documented in `apps/web/.env.example`. Copy it to a local `.env` (or equivalent) before running the dev server:

| Variable | Purpose | Default / example |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER` | Enables automatic devTicket detection/exchange for SSO auth | `false` |
| `NEXT_PUBLIC_AUTH_CHECK_INTERVAL` | How often auth status is polled, in milliseconds | `60000` |
| `NEXT_PUBLIC_APP_MODE` | Deployment mode: `oss-tenant`, `saas-tenant`, or `saas-shared` | `oss-tenant` |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager container ID | (empty) |
| `NEXT_PUBLIC_FEATURE_SCRIPT_SCHEDULE` | Feature flag for script scheduling UI | `false` |
| `NEXT_PUBLIC_PR_NUMBER_ENABLED` | Shows a PR-number field on the signup form (dev-only testing aid) | `false` |

Additional variables referenced by build scripts and configuration elsewhere in the repository:

| Variable | Used by | Notes |
|---|---|---|
| `PORT` | `apps/web/package.json` (`dev`, `start`, `start:standalone` scripts) | Defaults to `3000` if unset |
| `OPENFRAME_BUILD_TARGET` | `apps/web/next.config.mjs` | Set to `export` to produce the static export consumed by desktop/mobile shells (`npm run build:export`) |
| `OPENFRAME_BUNDLE_VERSION` | `apps/web/next.config.mjs`, `apps/web/Dockerfile` | Reported in the `X-OpenFrame-Client` header; falls back to `git describe` when unset |
| `NEXT_PUBLIC_TENANT_HOST_URL` | `apps/web/next.config.mjs` (rewrites), `apps/mobile/scripts/inject-env.mjs` | Tenant gateway host for local `/content/*` proxying and single-tenant mobile builds |
| `NEXT_PUBLIC_SHARED_HOST_URL` | `apps/mobile/scripts/inject-env.mjs`, `apps/desktop/Makefile`, Android build scripts | **Required** for a shippable mobile or desktop build — the shared auth host for discovery/OAuth; its absence fails the build intentionally |
| `NEXT_PUBLIC_MOBILE_APP_SCHEME` | `apps/mobile/scripts/inject-env.mjs` | OAuth callback URL scheme; must match the native build's registered scheme |
| `NEXT_PUBLIC_MOBILE_AUTH_UI` | `apps/mobile/scripts/inject-env.mjs` | `login-only` (default) or `legacy` auth screen variant |
| `OPENFRAME_SHARED_HOST_URL` | `apps/desktop/Makefile`, `apps/desktop/src-tauri/src/lib.rs` (via `option_env!`) | Baked into the desktop binary at compile time |
| `ANDROID_UPLOAD_STORE_FILE`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD` | `apps/mobile/android/app/build.gradle`, `apps/mobile/scripts/build-android-prod.sh` | Android release signing keystore; may also come from `gradle.properties` instead of the environment |
| `TAURI_SIGNING_PRIVATE_KEY` | `apps/desktop/Makefile` | Required to produce updater artifacts in `make build` |
| `ANALYZE` | `apps/web/next.config.mjs` | Set to `true` to enable the bundle analyzer |

> Never commit real secrets into `.env` files. Where this document does not list a concrete default, refer to your environment configuration.

---

### Verification commands

Run these from the relevant app directory to confirm your toolchain is ready.

**Node and npm versions:**

```bash
node --version   # expect a v24.x matching .nvmrc
npm --version    # expect >=11.11.0
```

**Web app (`apps/web`) — install and sanity-check:**

```bash
cd apps/web
npm ci
npm run type-check
npm run lint
npm run test
```

**Web app — start the dev server** (reads `PORT`, defaults to `3000`):

```bash
cd apps/web
npm run dev
```

**Web app — produce a static export** (used by the desktop/mobile shells):

```bash
cd apps/web
OPENFRAME_BUILD_TARGET=export npm run build
```

**Desktop shell (`apps/desktop`) — lint and test the Rust side:**

```bash
cd apps/desktop
make lint
make test
```

**Desktop shell — full build** (requires `OPENFRAME_SHARED_HOST_URL`):

```bash
cd apps/desktop
make build OPENFRAME_SHARED_HOST_URL=https://openframe.ai
```

**Mobile shell (`apps/mobile`) — stage a placeholder web bundle and sync native projects:**

```bash
cd apps/mobile
npm run web:placeholder
npm run sync
```

**Mobile shell — inject runtime environment into a staged bundle:**

```bash
cd apps/mobile
NEXT_PUBLIC_SHARED_HOST_URL="https://auth.openframe.ai" \
NEXT_PUBLIC_MOBILE_APP_SCHEME="com.openframe.app" \
node scripts/inject-env.mjs
```

**Rust toolchain check** (needed only for desktop work):

```bash
cargo --version   # should satisfy rust-version = "1.77.2" from apps/desktop/src-tauri/Cargo.toml
```

**Docker build check** (needed only for the containerized web deployment):

```bash
docker build -f apps/web/Dockerfile apps/web
```

If every command above completes without error, your environment is ready to proceed to [`./quick-start.md`](./quick-start.md).

---

### Next steps

Once the checks above pass, continue with [`./quick-start.md`](./quick-start.md) for a guided first run, or [`./introduction.md`](./introduction.md) for an overview of the platform this frontend belongs to. Contributors making code changes should also review [`../development/setup/environment.md`](../development/setup/environment.md), [`../development/setup/local-development.md`](../development/setup/local-development.md), and the contribution guidelines at [`../development/contributing/guidelines.md`](../development/contributing/guidelines.md).
