## Development Environment Setup

This guide covers the local tooling needed to work on **OpenFrame OSS Frontend**, a monorepo-style app combining a Next.js web client (`apps/web`), a Tauri desktop shell (`apps/desktop`), and a Capacitor mobile shell (`apps/mobile`). It is published as the `openframe_console` cargo artifact and depends on `@flamingo-stack/openframe-frontend-core` (from the [OpenFrame OSS Library](https://github.com/flamingo-stack/openframe-oss-lib)) and on `async_nats` from the [NATS Rust Client](https://github.com/flamingo-stack/nats.rs) fork, per the repository's ecosystem graph.

> For an architectural overview of how this frontend talks to backend services, see `../../reference/architecture/README.md`. For day-to-day run/build workflows once your environment is set up, see `./local-development.md`.

---

### Repository layout at a glance

| App | Path | Stack |
|---|---|---|
| Web (primary) | `apps/web` | Next.js (App Router) + React + TypeScript |
| Desktop shell | `apps/desktop` | Tauri 2 (Rust) wrapping the web export |
| Mobile shell | `apps/mobile` | Capacitor wrapping the web export |

Most day-to-day development happens inside `apps/web`; the desktop and mobile apps embed a static export of the same frontend and add a thin native shell around it.

---

## 1. Required development tools

| Tool | Version / Constraint | Where it's declared |
|---|---|---|
| Node.js | `24` | `.nvmrc` |
| npm | `>=11.11.0` | `devEngines.packageManager` in `apps/web/package.json`, `apps/desktop/package.json`, `apps/mobile/package.json` |
| TypeScript | `5.9.3` (web) | `apps/web/package.json` devDependencies |
| Git + Husky | `9.1.7` | `apps/web/package.json` devDependencies, hook at `.husky/pre-commit` |
| Rust toolchain | `rust-version = "1.77.2"` (2021 edition) | `apps/desktop/src-tauri/Cargo.toml` |
| Tauri CLI | `@tauri-apps/cli ^2.1.0` | `apps/desktop/package.json` devDependencies |
| Capacitor CLI | `@capacitor/cli ^8.4.3` | `apps/mobile/package.json` devDependencies |
| Android toolchain (Gradle/AGP) | Gradle plugin `com.android.tools.build:gradle:9.2.1` | `apps/mobile/android/build.gradle` |

### Node.js

Use the version pinned in `.nvmrc` (`24`). If you use `nvm`:

```bash
nvm install
nvm use
```

### Package manager

All three `package.json` files (`apps/web`, `apps/desktop`, `apps/mobile`) declare `devEngines.packageManager` requiring `npm >=11.11.0` with `"onFail": "error"` — an older npm will refuse the install. Check your version and upgrade if needed:

```bash
npm --version
npm install -g npm@latest
```

### Web app dependencies

From `apps/web`:

```bash
npm install
```

This installs the dependencies and devDependencies declared in `apps/web/package.json`, including `next` `16.3.6`, `react`/`react-dom` `19.2.4`, `relay-runtime`/`react-relay` `20.1.1`, `zustand` `5.0.11`, `zod` `4.3.6`, and the shared UI/component library `@flamingo-stack/openframe-frontend-core` (resolved from a `pkg.pr.new` build artifact in `apps/web/package.json`). Dev-only tooling includes `eslint` `9.39.5`, `prettier` `3.9.6`, `typescript` `5.9.3`, `vitest` `4.1.10`, and `relay-compiler` `20.1.1`.

The `apps/web/package.json` `prepare` script (`cd ../.. && husky || true`) wires up Git hooks automatically on `npm install` when run from the monorepo context.

### Desktop shell dependencies (optional, Rust required)

If you work on the Tauri desktop shell, install Rust via `rustup` matching the `rust-version = "1.77.2"` constraint in `apps/desktop/src-tauri/Cargo.toml`, then:

```bash
cd apps/desktop
npm install
```

The desktop shell's Rust dependencies include `tauri` `2` (with `tray-icon`, `image-png`, `macos-private-api` features), `tauri-plugin-updater`, and a forked `async-nats` client pulled from `https://github.com/flamingo-stack/nats.rs.git` for the background notification plane — consistent with the `async_nats` upstream dependency recorded for this repository.

### Mobile shell dependencies (optional)

```bash
cd apps/mobile
npm install
```

Building for iOS/Android additionally requires Xcode (iOS) and the Android SDK/Gradle toolchain referenced by `apps/mobile/android/build.gradle` and `apps/mobile/android/app/build.gradle` (Gradle plugin `9.2.1`, `compileSdk`/`minSdkVersion`/`targetSdkVersion` from `apps/mobile/android/variables.gradle`).

---

## 2. IDE recommendations and setup

### Recommended editor: Visual Studio Code

The repository ships committed VS Code configuration that the team is expected to use as-is:

- `.vscode/extensions.json` — recommended extensions
- `.vscode/settings.json` — formatter, linter, and TypeScript SDK wiring

Open the repository root in VS Code so these settings apply automatically.

### Key settings from `.vscode/settings.json`

- **TypeScript SDK**: pinned to the workspace copy at `apps/web/node_modules/typescript/lib` (`typescript.tsdk`), so the editor's TS version always matches what `apps/web/package.json` declares (`5.9.3`), not whatever is globally installed.
- **Format on save**: `editor.formatOnSave: true` with `editor.defaultFormatter: esbenp.prettier-vscode` as the default formatter for TypeScript, TSX, JavaScript, JSX, JSON, JSONC, and CSS.
- **Lint-fix on save**: `editor.codeActionsOnSave` runs `source.fixAll.eslint: explicit` — ESLint autofixes (including import sorting via the `perfectionist/sort-imports` rule) run as part of save, separately from Prettier's formatting pass. The settings file explicitly warns against also adding `source.organizeImports`, since VS Code's own import sorter would fight the ESLint rule.
- **ESLint flat config**: `eslint.useFlatConfig: true`, with `eslint.workingDirectories` pointed at `apps/web` (`changeProcessCWD: true`) because the ESLint config and `node_modules` live there, not at the monorepo root.
- **ESLint formatter role disabled**: `eslint.format.enable: false` is intentional — if a global user setting turns this on, the ESLint extension registers itself as a document formatter and "Format Document" silently runs `eslint --fix` instead of Prettier, which (per the comment in the settings file) formats nothing because the shared ESLint config spreads `eslint-config-prettier` last.
- **Biome explicitly disabled**: `"biome.enabled": false` — Biome was removed from this repository (2026-09-01) in favor of ESLint + Prettier, and this setting prevents a globally installed Biome extension from reformatting the workspace against a config that no longer exists. `.vscode/extensions.json` also lists `biomejs.biome` under `unwantedRecommendations`.
- **Search exclusions**: `**/dist` and `**/.next` are excluded from search.

> **Important:** The editor's ESLint pass (`eslint.config.mjs`, loaded per `.vscode/settings.json`) only runs the fast, non-type-aware rules. Type-aware rules live in `eslint.types.mjs` and need an 8 GB heap — they are *not* run by the editor. Run `npm run lint:types` before pushing (see below).

### Recommended extensions

From `.vscode/extensions.json`:

| Extension ID | Purpose |
|---|---|
| `esbenp.prettier-vscode` | Prettier formatting (the default formatter for all file types configured in `.vscode/settings.json`) |
| `dbaeumer.vscode-eslint` | ESLint integration (lint-on-save autofix) |

Do **not** install `biomejs.biome` — it is listed under `unwantedRecommendations` in `.vscode/extensions.json`.

### EditorConfig

`apps/mobile/.editorconfig` defines baseline whitespace conventions for the repository: UTF-8, LF line endings, trimmed trailing whitespace, and a final newline, with 2-space indentation for TypeScript/JSON/YAML files and 4-space indentation for Java/Kotlin/Swift files. Markdown files are exempted from trailing-whitespace trimming. If your editor supports the EditorConfig standard (most do, natively or via a plugin), this is picked up automatically.

---

## 3. Environment variables for development

The canonical list of frontend environment variables lives in `apps/web/.env.example`. Copy it to create your local environment file:

```bash
cd apps/web
cp .env.example .env.local
```

| Variable | Purpose | Default / example |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER` | Enables the global DevTicket observer for SSO authentication (automatic devTicket detection and exchange) | `false` |
| `NEXT_PUBLIC_AUTH_CHECK_INTERVAL` | How often auth status is checked, in milliseconds | `60000` |
| `NEXT_PUBLIC_APP_MODE` | Deployment mode: `oss-tenant`, `saas-tenant`, or `saas-shared` | `oss-tenant` |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager container ID | (empty) |
| `NEXT_PUBLIC_FEATURE_SCRIPT_SCHEDULE` | Feature flag for script scheduling functionality | `false` |
| `NEXT_PUBLIC_PR_NUMBER_ENABLED` | Shows a PR-number field on the signup form, linking registrations to a git PR for testing — enable only on dev environments | `false` |

> `apps/web/.env.example` is explicitly annotated: keep `NEXT_PUBLIC_PR_NUMBER_ENABLED` disabled on stage and prod.

### Runtime/dev-server variables used by npm scripts

The scripts in `apps/web/package.json` reference a few additional environment variables at invocation time rather than through `.env`:

- `PORT` — used by both `dev` (`next dev -p ${PORT:-3000}`) and `start` (`next start -p ${PORT:-3000}`); defaults to `3000` when unset.
- `OPENFRAME_BUILD_TARGET` — set to `export` by the `build:export` script to produce the static SPA bundle consumed by the desktop and mobile shells (`apps/web/next.config.mjs` reads this to switch Next's `output` between `standalone` and `export`).
- `NODE_OPTIONS` — set to `--max-old-space-size=8192` by the `lint:types` script, because the type-aware ESLint pass needs an 8 GB heap.
- `HOSTNAME` — used by `start:standalone` (defaults to `0.0.0.0`).

### Mobile shell environment injection

`apps/mobile/scripts/inject-env.mjs` (documented in `apps/mobile/scripts/.inject-env.md`) builds a `window.__ENV` bootstrap that is injected into the static bundle's `index.html` at build time, since the Capacitor shell has no server to source `.env` values from at runtime. It reads, with defaults:

- `NEXT_PUBLIC_SHARED_HOST_URL` — **required**; the build aborts (`process.exit(1)`) if unset, since auth/discovery calls would otherwise resolve against `capacitor://localhost` and fail.
- `NEXT_PUBLIC_TENANT_HOST_URL` — optional single-tenant pin for dev/self-hosted builds.
- `NEXT_PUBLIC_ENABLE_DEV_TICKET_OBSERVER` — defaults to `false`.
- `NEXT_PUBLIC_APP_MODE` — defaults to `oss-tenant`.
- `NEXT_PUBLIC_MOBILE_APP_SCHEME` — OAuth callback URL scheme; defaults to `com.openframe.app`, and must match the native iOS build setting for the target lane (prod/stage/dev use distinct schemes so side-by-side installs don't collide).
- `NEXT_PUBLIC_MOBILE_AUTH_UI` — `login-only` (default) or `legacy`, controlling which auth screens are shown.

Run it manually, for example:

```bash
cd apps/mobile
NEXT_PUBLIC_SHARED_HOST_URL="https://auth.openframe.ai" \
NEXT_PUBLIC_MOBILE_APP_SCHEME="com.openframe.app" \
node scripts/inject-env.mjs
```

### Android release signing (optional, desktop/mobile release builds only)

`apps/mobile/android/app/build.gradle` reads release-signing credentials from either environment variables or Gradle properties (env wins): `ANDROID_UPLOAD_STORE_FILE`, `ANDROID_UPLOAD_STORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`, `ANDROID_UPLOAD_KEY_PASSWORD`. When all four are present, release builds are signed; otherwise release builds are left unsigned and a log message notes it. These are not needed for day-to-day web development.

---

## 4. Editor extensions / plugins and tooling behavior

### Formatting: Prettier

`apps/web/prettier.config.mjs` re-exports the shared preset from `@flamingo-stack/openframe-frontend-core/eslint-config/prettier`, which reproduces the project's former Biome formatter settings byte-for-byte (120-column width, single quotes, trailing commas, avoided arrow parens) plus Tailwind class sorting. Run it directly with:

```bash
cd apps/web
npm run format        # check only
npm run format:fix    # write changes
```

### Linting: ESLint (flat config)

`apps/web/eslint.config.mjs` composes shared presets from `@flamingo-stack/openframe-frontend-core/eslint-config` (`next`, `relay`, `tests`, `prettier-compat`, applied in that order — `prettier-compat` last so it always wins over any new stylistic rule) plus one local rule module, `apps/web/eslint-rules/react-hook-form-needs-no-memo.mjs`. Several named, file-scoped exemption blocks document *why* specific files opt out of specific rules (e.g. `openframe-frontend/hydrate-from-browser-storage` for components that read `localStorage`/`sessionStorage` post-mount, or `openframe-frontend/node-test-runner` for the `node --test`-based files under `src/lib/*.test.mjs`) — per the active rule **OFFE-006**, inline `eslint-disable` comments are rejected (`noInlineConfig` is on) and any new suppression must follow this same pattern: a named block in `eslint.config.mjs` stating the reason, not an inline comment.

Available lint scripts in `apps/web/package.json`:

```bash
npm run lint         # fast pass, cached, --max-warnings 0
npm run lint:fix      # fast pass with autofix
npm run lint:types    # type-aware rules (eslint.types.mjs), 8 GB heap, not cached
npm run lint:cycles   # import-cycle detection (eslint.cycles.mjs)
npm run lint:ci       # the exact gate CI/the pre-commit hook run (eslint.ci.mjs)
```

> Active rule **OFFE-007** requires icons to come from `@flamingo-stack/openframe-frontend-core/components/icons-v2` (or `…/components/icons` for the legacy `MingoIcon`) — `lucide-react` is not a dependency and must not be added.

### Type checking

```bash
cd apps/web
npm run type-check   # tsc --noEmit, using apps/web/tsconfig.json
```

`apps/web/tsconfig.json` targets `ES6`, uses `moduleResolution: bundler`, `jsx: react-jsx`, strict mode, and the `@/*` path alias mapped to `./src/*` — the same alias the VS Code TypeScript SDK setting and the editor's IntelliSense rely on.

### Git hooks (Husky)

`.husky/pre-commit` runs automatically on every commit once `npm install` has executed the `prepare` script in `apps/web/package.json`. It is POSIX `sh`, not bash, and performs, scoped only to **staged** `*.ts`/`*.tsx`/`*.js`/`*.jsx`/`*.mjs`/`*.cjs` files:

1. Refuses to proceed if a staged file also has further unstaged edits, to avoid validating content that would not actually be committed.
2. Runs `eslint --config eslint.ci.mjs --no-warn-ignored --max-warnings 0` against the staged files — the identical gate used in CI, so the hook and the PR check can never disagree.
3. Runs `prettier --check --ignore-unknown` against the staged files.
4. Runs `tsc --noEmit --pretty false` and filters the output down to diagnostics anchored in staged files, failing the commit if any remain.

This means local commits are blocked by the same lint/format/type rules CI enforces — there is no way to "skip" formatting or lint errors on committed files short of fixing them or amending the relevant shared-config exemption block.

### Relay (GraphQL) tooling

The web app uses Relay for GraphQL data fetching (`react-relay`, `relay-runtime`, `relay-compiler`, all pinned to `20.1.1` in `apps/web/package.json`). Relevant scripts:

```bash
npm run fetch-schema   # node scripts/fetch-schema.mjs
npm run relay           # relay-compiler (one-shot)
npm run relay:watch     # relay-compiler --watch
```

`apps/web/next.config.mjs` also configures the Next.js `compiler.relay` option (source directory `./src`, TypeScript, artifacts written to `./src/__generated__`), and `npm run build` runs `generate-enums` (via `apps/web/scripts/generate-schema-enums.mjs`) and `relay-compiler` ahead of `next build`.

### Testing

```bash
npm test        # vitest run && node --test src/lib/*.test.mjs
npm run test:watch  # vitest in watch mode
```

`vitest` (`4.1.10`) and `jsdom` (`29.1.1`) are the devDependencies backing the test runner; see `../testing/README.md` for broader testing conventions.

---

## Next steps

Once your tools and environment variables are in place, continue to `./local-development.md` for day-to-day run, build, and workflow commands, or review `../architecture/README.md` and `../../reference/architecture/README.md` for how the pieces configured here fit into the wider OpenFrame platform. Contribution conventions (commit message tagging, PR expectations) are covered in `../contributing/guidelines.md`.
