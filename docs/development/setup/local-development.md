## Local Development

This guide covers cloning the repository, installing dependencies, running each app locally, enabling hot reload, and configuring debuggers. The repository is a monorepo containing a Next.js web app (`apps/web`), a Tauri desktop shell (`apps/desktop`), and a Capacitor mobile shell (`apps/mobile`).

> Before you start, review the [Prerequisites](../../getting-started/prerequisites.md) and [Quick Start](../../getting-started/quick-start.md) guides, and the [Environment Configuration](./environment.md) page for the variables referenced below.

### Repository layout at a glance

| App | Path | Package manager scripts | Purpose |
|---|---|---|---|
| Web | `apps/web` | `apps/web/package.json` | Next.js (App Router) frontend — the primary OpenFrame OSS UI |
| Desktop | `apps/desktop` | `apps/desktop/package.json` | Tauri shell (`openframe-console`) embedding the web app's static export |
| Mobile | `apps/mobile` | `apps/mobile/package.json` | Capacitor shell wrapping the same static export for iOS/Android |

All three apps share one invariant worth remembering while you work: the desktop and mobile shells carry **no UI code of their own** — they stage the web app's static export (`npm run build:web`) and embed it. Day-to-day UI development therefore happens almost entirely in `apps/web`.

---

## 1. Clone and setup

### Clone the repository

```bash
git clone https://github.com/flamingo-stack/openframe-oss-frontend.git
cd openframe-oss-frontend
```

### Package manager requirement

Each app's `package.json` declares an `devEngines.packageManager` constraint:

```json
"devEngines": {
  "packageManager": {
    "name": "npm",
    "version": ">=11.11.0",
    "onFail": "error"
  }
}
```

Make sure your local `npm` satisfies this before installing — an older npm fails the install with an explicit error rather than silently proceeding.

### Install dependencies — web app

```bash
cd apps/web
npm ci
```

`npm ci` is preferred over `npm install` for a clean, lockfile-exact install matching `apps/web/package.json` and its lockfile.

### Configure environment variables

Copy the example environment file and adjust values for your setup:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Key variables defined in `apps/web/.env.example`:

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER` | Enables automatic devTicket detection/exchange for SSO | `false` |
| `NEXT_PUBLIC_AUTH_CHECK_INTERVAL` | How often auth status is polled, in ms | `60000` |
| `NEXT_PUBLIC_APP_MODE` | One of `oss-tenant`, `saas-tenant`, `saas-shared` | `oss-tenant` |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager container id | empty |
| `NEXT_PUBLIC_FEATURE_SCRIPT_SCHEDULE` | Enables script scheduling UI | `false` |
| `NEXT_PUBLIC_PR_NUMBER_ENABLED` | Shows the PR-number field on the signup form (dev-only) | `false` |

For a full explanation of these and other runtime variables (including tenant host resolution), see [Environment Configuration](./environment.md).

### Dependency on `openframe-frontend-core`

The web app depends on `@flamingo-stack/openframe-frontend-core`, published from the [OpenFrame OSS Library](https://github.com/flamingo-stack/openframe-oss-lib) repository and currently pinned in `apps/web/package.json` to a `pkg.pr.new` preview build:

```json
"@flamingo-stack/openframe-frontend-core": "https://pkg.pr.new/flamingo-stack/openframe-oss-lib/@flamingo-stack/openframe-frontend-core@0.0.733"
```

If you are iterating on shared UI primitives in that library locally, the web app exposes `yalc`-based linking scripts:

```bash
npm run core:link      # yalc add @flamingo-stack/openframe-frontend-core
npm run core:unlink    # yalc remove @flamingo-stack/openframe-frontend-core
```

This lets you point the frontend at a local build of the shared core package without republishing to `pkg.pr.new` on every change.

### Desktop and mobile setup

The desktop shell (`apps/desktop`) stages a placeholder bundle automatically before `dev` runs (see `predev` below), so a bare `npm ci` in `apps/desktop` is enough to get the Tauri shell compiling:

```bash
cd apps/desktop
npm ci
```

The mobile shell (`apps/mobile`) similarly depends on the web app's static export being staged into `www/`:

```bash
cd apps/mobile
npm ci
```

---

## 2. Running locally

### Web app

From `apps/web`:

```bash
npm run dev
```

This runs `next dev -p ${PORT:-3000}` (see the `dev` script in `apps/web/package.json`), so the app is served on port `3000` by default. Override the port with the `PORT` environment variable:

```bash
PORT=4000 npm run dev
```

Once running, the app is served by Next.js's App Router, with routes organized under `apps/web/src/app` (for example `apps/web/src/app/(app)/customers`, `apps/web/src/app/(app)/devices`, `apps/web/src/app/(app)/dashboard`, and `apps/web/src/app/(app)/help-center`).

To run a production-equivalent build locally instead of the dev server:

```bash
npm run build         # generate-enums -> relay-compiler -> next build
npm run start          # next start -p ${PORT:-3000}
```

There is also `npm run build:local`, which runs `next build --webpack` (bypassing the Turbopack/default bundler path), and `npm run build:export`, which sets `OPENFRAME_BUILD_TARGET=export` for producing the static export consumed by the desktop and mobile shells.

> `npm run build` first regenerates GraphQL schema enums (`generate-enums`, via `apps/web/scripts/generate-schema-enums.mjs`) and compiles Relay artifacts (`relay-compiler`) before invoking `next build`. If your GraphQL schema changed, fetch the latest schema with `npm run fetch-schema` (`apps/web/scripts/fetch-schema.mjs`) first.

### Desktop shell (Tauri)

From `apps/desktop`:

```bash
npm run dev
```

This runs `tauri dev --no-dev-server`, and is preceded automatically by the `predev` hook (`node scripts/make-placeholder-web.mjs --if-missing`), which writes a minimal placeholder `www/index.html` if no bundle has been staged yet — enough for the Rust shell to compile and run without first building the full Next.js export.

To embed the **real** web app export instead of the placeholder, stage it explicitly before running dev:

```bash
npm run build:web   # bash scripts/build-web.sh — builds apps/web as a static export into www/
npm run dev
```

`apps/desktop/scripts/build-web.sh` runs `npm ci` in `apps/web` if `node_modules` is missing, then builds with `OPENFRAME_BUILD_TARGET=export npm run build`, and copies the resulting `apps/web/dist` into `apps/desktop/www`.

A full unsigned desktop build (for local testing, skipping updater artifacts) is documented in `apps/desktop/Makefile`:

```bash
make web
OPENFRAME_SHARED_HOST_URL=<host> npx tauri build --bundles app \
  --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

The desktop Makefile also exposes `make build`, `make lint`, `make test`, and `make clean` targets — see `apps/desktop/Makefile` for the full target list and required `OPENFRAME_SHARED_HOST_URL`/`OPENFRAME_VERSION` variables.

### Mobile shell (Capacitor)

From `apps/mobile`, stage the web bundle and sync the native projects:

```bash
npm run build:web    # bash scripts/build-web.sh
npm run sync          # cap sync
npm run open:ios      # cap open ios
npm run run:ios       # cap run ios
```

`apps/mobile/scripts/build-android-dev.sh`, `build-android-stage.sh`, `build-ios-dev.sh`, and `build-ios-stage.sh` provide full per-environment build lanes (web bundle + native archive/APK, optionally distributed via Firebase App Distribution or TestFlight). Each script documents its required environment variables (for example `NEXT_PUBLIC_SHARED_HOST_URL`) and optional flags (`SKIP_WEB=1`, `WEB_ONLY=1`, `SKIP_DISTRIBUTE=1`) in its header comments — consult the script you need directly for the exact flags it supports.

For local iteration without a full native rebuild, pass `WEB_ONLY=1` to stage the web bundle and run `cap sync`, then open the project in Xcode or Android Studio and run the relevant debug variant directly.

### Container build

`apps/web/Dockerfile` defines a multi-stage build producing a Next.js standalone server image, pinned to `node:26.13.0-alpine3.24`. The `builder` stage runs `npm ci --no-audit --no-fund` followed by `npm run build`; the `runner` stage copies `dist/standalone`, `dist/static`, `public`, and `scripts/server-entry.js`, and starts the app via `node server-entry.js` as a non-root `nextjs` user on port `3000`. This is the same image published through the `release` and `test` CI workflows as `ghcr.io/flamingo-stack/openframe-oss-frontend/openframe-oss-frontend`.

To run the standalone server output locally without Docker (after a build):

```bash
npm run start:standalone
```

This script (see the `start:standalone` entry in `apps/web/package.json`) copies `public/` and static assets into `dist/standalone`, then starts `scripts/server-entry.js` with `PORT`/`HOSTNAME` set.

---

## 3. Hot reload / watch mode

### Web app

`next dev` (invoked by `npm run dev`) provides Next.js's built-in Fast Refresh for React components and route files under `apps/web/src/app`.

### Relay watch mode

If you are editing GraphQL fragments/queries, run the Relay compiler in watch mode alongside `next dev` so generated artifacts stay in sync:

```bash
npm run relay:watch
```

This runs `relay-compiler --watch` (see `apps/web/package.json`). A one-shot compile is also available via `npm run relay`.

### Test watch mode

```bash
npm run test:watch
```

This runs `vitest` in watch mode. The one-shot test command (`npm run test`) runs `vitest run` followed by `npm run test:node` (which executes `node --test src/lib/*.test.mjs`).

### Lint on save / fix

```bash
npm run lint         # eslint with cache, --max-warnings 0
npm run lint:fix      # eslint --fix
```

Editor-level linting is already configured in `.vscode/settings.json`: ESLint's flat config (`eslint.useFlatConfig: true`) is pointed at `apps/web` via `eslint.workingDirectories`, and `editor.codeActionsOnSave` runs `source.fixAll.eslint` on save. Formatting on save uses Prettier (`esbenp.prettier-vscode` is the default formatter for TypeScript/TSX/JS/JSON/CSS — see the `[typescript]`, `[typescriptreact]`, etc. blocks in `.vscode/settings.json`). Note that `eslint.format.enable` is deliberately left off: the shared ESLint config spreads `eslint-config-prettier` last, so letting ESLint act as the formatter would format nothing. Recommended VS Code extensions are declared in `.vscode/extensions.json` (`esbenp.prettier-vscode`, `dbaeumer.vscode-eslint`); the now-removed Biome extension is explicitly listed as unwanted.

> Type-aware lint rules (`npm run lint:types`, using `eslint.types.mjs`) and import-cycle checks (`npm run lint:cycles`, using `eslint.cycles.mjs`) are **not** run by the editor's on-save integration — they need a full TypeScript program and a large heap (`NODE_OPTIONS=--max-old-space-size=8192`). Run them manually before pushing.

### Desktop shell

The desktop shell has no equivalent "watch mode" for Rust changes — `tauri dev` recompiles on Rust source changes and reloads the webview automatically, but UI changes require re-running `npm run build:web` to refresh the staged `www/` bundle (or rely on the placeholder bundle during pure shell development).

### Mobile shell

The mobile shell stages a static export rather than live-reloading; `capacitor.config.ts` deliberately must **not** carry a `server.url` live-reload pointer in a shippable build — the build scripts (`build-android-dev.sh`, `build-android-stage.sh`, `build-android-prod.sh`, `build-ios-dev.sh`) each guard against this by scanning `capacitor.config.ts` for a `server: { url: ... }` block and failing the build if one is present.

---

## 4. Debug configuration

### Web app (browser / Node)

Since `apps/web` runs on Next.js, you can debug both server-side and client-side code:

- **Client-side**: use your browser's DevTools against `npm run dev` on `http://localhost:3000` (or your configured `PORT`).
- **Server-side**: Next.js respects standard Node.js inspector flags. Run the dev server with the inspector enabled, e.g. `NODE_OPTIONS='--inspect' npm run dev`, then attach your editor's Node debugger to the reported port.
- **Type checking**: run `npm run type-check` (`tsc --noEmit`) to surface type errors without a full build — useful as a lightweight sanity check before debugging runtime behavior.

### Desktop shell (Rust / Tauri)

The Tauri shell is a standard Rust crate (`apps/desktop/src-tauri`, crate name `app_lib`, binary `openframe-console`, see `apps/desktop/src-tauri/Cargo.toml`). Standard Rust debugging tooling applies:

- Build with debug symbols via `cargo build` (invoked transitively by `tauri dev`), then attach `lldb`/`gdb` or your editor's Rust debugger to the running `openframe-console` process.
- `apps/desktop/src-tauri/src/lib.rs` and related modules (`nats.rs`, `tokens.rs`, `notifications.rs`, `chat_api.rs`, `autostart.rs`, `updater.rs`) log extensively via the `log` crate; the shell is configured with `tauri-plugin-log`, so console/log output is the primary diagnostic channel during local runs.
- `apps/desktop/Makefile` provides `make clippy` (`cargo clippy --all-targets -- -D warnings`) and `make fmt-check` (`cargo fmt --all -- --check`) for catching issues before a full debug session; `make test` (`cargo test`) runs the Rust test suite, including the unit tests embedded in modules like `chat_api.rs` (see its `#[cfg(test)] mod tests`).
- Platform-specific modules are conditionally compiled — for example `macos_un.rs` and `macos_wake.rs` only build under `target_os = "macos"`, and `windows_activator.rs`/`windows_toast.rs` only under Windows (with `windows_toast` also compiled for `cfg(test)` on macOS so its logic can be exercised in CI regardless of host OS). Be mindful of which platform you are debugging on when stepping through shell code.

### Mobile shell (Capacitor / native)

- **iOS**: open the Xcode project via `npm run open:ios` (`cap open ios`) and use Xcode's debugger/breakpoints against the native Swift layer, or Safari's Web Inspector attached to the embedded WKWebView for the JS/HTML layer.
- **Android**: open `apps/mobile/android` in Android Studio to debug Java plugin code (for example `MainActivity.java`, `NativeAuthPlugin.java`, `NativeFilesPlugin.java`, `TokenLifecycle.java` under `apps/mobile/android/app/src/main/java/ai/openframe/mobile/`), or use `adb logcat` to follow the app's dedicated log tags. `ShellLog.java` defines two tagged log streams you can filter on:

```bash
adb logcat -s OpenFrameAuth OpenFrameNotifications
```

- Android instrumented and unit tests exist at `apps/mobile/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java` and `apps/mobile/android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`; run the instrumented suite with:

```bash
./gradlew connectedAndroidTest
```

(executed from `apps/mobile/android`, using the Gradle wrapper at `apps/mobile/android/gradlew`).

---

## Where this fits in the system

This repository has no recorded downstream consumers in the code graph — it is the top-level frontend application, not a library other repositories import. It depends on the [OpenFrame OSS Library](https://github.com/flamingo-stack/openframe-oss-lib) (a manually-tracked relationship) and, transitively through the desktop shell's `async-nats` dependency, on the flamingo-stack fork of the NATS Rust client. Day-to-day frontend work in `apps/web` does not require building that library locally — it is consumed as a published npm package (`@flamingo-stack/openframe-frontend-core`) — but if you need to change shared UI primitives, see the `core:link`/`core:unlink` workflow above.

For the broader architectural picture (how the frontend's customers, devices, tickets, and Mingo AI chat modules integrate with backend services like the API Service Core and Authorization Service), see the [Architecture Overview](../../reference/architecture/README.md), the [Api Client](../../reference/architecture/api-client/api-client.md) reference for how authentication and Fleet MDM calls are structured, and the [Api Lib Dto](../../reference/architecture/api-lib-dto/api-lib-dto.md) reference for the shared contract types consumed across GraphQL and REST. For contribution standards once your local environment is running, see the [Contributing Guidelines](../contributing/guidelines.md).
