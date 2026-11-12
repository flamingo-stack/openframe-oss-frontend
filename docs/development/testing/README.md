
# Testing

This page covers how tests are organized and run in `openframe-oss-frontend`, how to write new tests for the `apps/web` (Next.js) frontend, and the coverage/CI expectations enforced on pull requests.

> This repository publishes the `openframe_console` Rust crate (the `apps/desktop` Tauri shell) and depends on `@flamingo-stack/openframe-frontend-core` and `async_nats`. Testing conventions here are specific to this repository; consumers of its published artifacts are not currently recorded in the organization's dependency graph (coverage is partial), so there is no cross-repo contract test suite to maintain here beyond what is described below.

## Where tests live

The monorepo has three app targets — `apps/web` (Next.js frontend), `apps/desktop` (Tauri console), and `apps/mobile` (Capacitor shell) — and each owns its own test setup.

### `apps/web` — the Next.js frontend

This is where the vast majority of tests live, split across **two runners**:

| Runner | File pattern | Why |
|---|---|---|
| Vitest | `src/**/*.test.ts`, `src/**/*.test.tsx` | Component/hook-level logic, anything that needs `jsdom` or the core library barrel |
| Node's built-in test runner (`node --test`) | `src/lib/*.test.mjs` | Pre-existing plain-Node tests that import `node:test`, not vitest |

The split is deliberate and documented in `apps/web/vitest.config.mts`: Vitest's `include` only covers `.ts`/`.tsx`, because the `.test.mjs` files under `src/lib` import `node:test` and would fail if picked up by Vitest.

Tests are colocated next to the code they exercise rather than in a separate `__tests__` tree. Examples from the repository:

- `apps/web/src/proxy.test.ts` — pins the Edge middleware's `/mobile` allowlist behavior.
- `apps/web/src/lib/app-mode.test.ts` — pins the app-side route-allowlist logic that `proxy.test.ts` pins on the Edge side (two deliberately separate implementations, two separate test files, kept from drifting apart).
- `apps/web/src/lib/app-version.test.ts` — pure-function tests for version parsing/comparison.
- `apps/web/src/lib/api-client.test.ts` — mocks the token/session/platform modules to pin `apiClient`'s behavior on a `426 Client Upgrade Required` response.
- `apps/web/src/lib/auth-api-client.test.ts` — pins the wire shape of the one unauthenticated GraphQL call (`authErrorMessage`) made from the error page before any session exists.
- `apps/web/src/lib/ai-balance-tone.test.ts` — small pure-function table tests for a tone-selection helper.

### `apps/desktop` and `apps/mobile`

The desktop Tauri shell (`apps/desktop/src-tauri`) is Rust; its tests run through `make test`/`make lint` under `apps/desktop/src-tauri`, invoked from CI's `desktop_test` job (see `.github/workflows/test.yml`). The mobile shell (`apps/mobile`) wraps a static web export via Capacitor and carries the stock Android scaffold tests (`apps/mobile/android/app/src/androidTest/.../ExampleInstrumentedTest.java` and `apps/mobile/android/app/src/test/.../ExampleUnitTest.java`) — these are the default Capacitor/Android template tests, not application-specific suites.

## Running tests

All frontend commands below run from `apps/web` (the `package.json` at `apps/web/package.json` defines these scripts).

### Run everything

```bash
cd apps/web
npm test
```

`npm test` runs both runners in sequence: `vitest run && npm run test:node`. This is the same command CI's `unit_test` job runs.

### Run only the Vitest suite

```bash
cd apps/web
npx vitest run
```

Or in watch mode while developing:

```bash
cd apps/web
npm run test:watch
```

### Run only the Node-runner suite

```bash
cd apps/web
npm run test:node
```

This runs `node --test src/lib/*.test.mjs` directly — it will not pick up any `.test.ts`/`.test.tsx` file.

### Generated code required before testing

Some tests import generated artifacts (Relay compiler output, schema enums) that are git-ignored. Generate them before running tests locally, the same way CI does it:

```bash
cd apps/web
npm run generate-enums
npx relay-compiler
npm test
```

CI's `unit_test` job in `.github/workflows/test.yml` runs exactly this sequence (`npm run generate-enums && npx relay-compiler`, then `npm test`) after `npm ci --no-audit --no-fund`.

### Desktop (Rust) tests

```bash
cd apps/desktop
make test
```

CI runs this via the `desktop_test` job's "Run tests" step, scoped to `apps/desktop` with `working-directory: apps/desktop`, and only when `.github/workflows/test.yml`'s path filter detects a change under `apps/desktop` or `.github/steps/rust-setup`.

## Writing new tests

### Conventions observed in the existing suite

- **Colocate the test next to the source file**, using the `.test.ts` / `.test.tsx` suffix (for Vitest) in the same directory as the module under test — e.g. `src/lib/app-version.ts` → `src/lib/app-version.test.ts`.
- **Mock at the module boundary with `vi.mock`.** `api-client.test.ts` and `auth-api-client.test.ts` both mock out `./platform`, `./token-store`, `./token-refresh-manager`, `./force-logout`, and `./runtime-config` so the test exercises only the client logic, not the modules it depends on. Use `vi.hoisted()` when a mock factory needs to reference a variable declared outside it (both files do this for shared mock functions).
- **Stub `fetch` explicitly** rather than hitting the network. The pattern in `auth-api-client.test.ts` builds a small `jsonResponse()` helper returning an object shaped like a `Response` (with `ok`, `status`, `headers.get`, and `json()`), then does `vi.stubGlobal('fetch', fetchMock)` in `beforeEach` and `vi.unstubAllGlobals()` in `afterEach`.
- **Assert on the request, not just the response**, when pinning a wire contract. `auth-api-client.test.ts` checks the exact URL (`https://auth.test/sas/graphql`), method, `credentials: 'omit'`, headers, and the parsed request body — not only the decoded result.
- **Use `describe.each` / `it.each` for table-style pure-function tests.** `app-version.test.ts` uses `it.each([...])('treats %j as unknown', ...)` to cover a list of invalid inputs in one block.
- **Keep environment-dependent logic testable via dependency injection of globals.** `app-mode.test.ts` writes to `window.__ENV` directly (the same object `next-runtime-env`'s `env()` reads in the browser) via a small `setEnv()` helper, and resets it in `afterEach`.
- **When two implementations of the same logic exist on purpose** (for example, an Edge-runtime copy and an app-runtime copy that cannot share code because one needs browser globals the other lacks), write a **separate pinning test for each one**, as `proxy.test.ts` and `app-mode.test.ts` do for the `/mobile` route allowlist. Say so in a comment, as both files do, so it's clear the duplication is deliberate and both files must be updated together.
- **Reset mocks in `beforeEach`**, not just once: `api-client.test.ts` calls `mocks.refreshTokens.mockReset()` and `mocks.forceLogout.mockReset()` before each test, and rebuilds the `fetch` mock there too.
- **Use `vi.resetModules()` plus dynamic `import()`** inside a `load()` helper when the module under test reads configuration at import time, so each test gets a fresh module instance (see `api-client.test.ts`'s `load()`).

### Choosing Vitest vs the Node runner

New tests should default to **Vitest** (`*.test.ts` / `*.test.tsx`) unless there is a specific reason to use the plain Node runner. The Node-runner path (`src/lib/*.test.mjs`) exists only for the pre-existing files that import `node:test`; it is not the pattern to copy for new code. If a new test needs `jsdom` (anything touching the DOM, or anything importing the `@flamingo-stack/openframe-frontend-core` barrel, which reaches for browser globals at module scope), it will get it automatically — `apps/web/vitest.config.mts` sets `test.environment` to `jsdom` for the whole suite.

### The `@flamingo-stack/openframe-frontend-core` dependency in tests

`apps/web/vitest.config.mts` configures `test.server.deps.inline` to force the core library through Vite's resolver rather than Node's raw ESM loader, because the library's bundle imports Next.js entry points extensionlessly (`next/link`, `next/navigation`) the way Vite's bundler — but not Node — can resolve. If a new test imports anything from `@flamingo-stack/openframe-frontend-core` and fails with a module-resolution error under Vitest, this is the setting responsible; it should not need touching for normal test authoring, but it explains why those imports work at all under test.

### Path alias

Tests can use the `@/` alias for `apps/web/src`, configured via `resolve.alias` in `apps/web/vitest.config.mts` (mirroring the app's own `tsconfig` alias).

### Setup file

`apps/web/vitest.config.mts` references `./vitest.setup.ts` as the global `setupFiles` entry, and sets `globals: false` — meaning `describe`, `it`, `expect`, etc. must be imported explicitly from `vitest` in every test file (as every example test in this repository does), rather than relying on injected globals.

## Coverage requirements

There is no dedicated coverage-threshold tool or `--coverage` invocation configured in `apps/web/package.json` or `apps/web/vitest.config.mts`. Coverage is enforced procedurally through CI gating rather than a numeric threshold:

- **`.github/workflows/test.yml`** defines an `unit_test` job that runs `npm test` (both Vitest and the Node runner) on every pull request targeting `main`, gated behind the `changes` job's `web` path filter (it only runs when files outside `apps/desktop/**` and `apps/mobile/**` changed).
- The `all-checks` job in the same workflow aggregates `static`, `lint`, `unit_test`, `build_image`, and `desktop_test`: if any of these fail or are cancelled, `all-checks` fails, which is what blocks a merge.
- There is no separate "coverage report" artifact or percentage gate in the workflow — the practical requirement is that **`npm test` passes** for any change touching `apps/web`, and **`make test`** passes for any change touching `apps/desktop`.
- Linting is a related, separately enforced gate: `npm run lint:ci` (ESLint with `--max-warnings 0`, using `apps/web/eslint.ci.mjs`) runs in the `lint` job and must pass cleanly — ESLint warnings fail the build, not just errors.

In practice, this means: when adding a new module or hook under `apps/web/src`, add a colocated `*.test.ts`/`*.test.tsx` file exercising its observable behavior (especially anything handling tokens, auth state, route gating, or response envelopes — the categories every existing test file targets), and confirm `npm test` passes locally before opening a pull request. There is no enforced minimum percentage; the bar is that the suite captures the behavior you are changing or introducing, particularly for logic that is security- or correctness-sensitive (auth, token refresh, route allowlists, version gating) as the existing tests demonstrate.

## Related CI jobs reference

| Job (`.github/workflows/test.yml`) | Scope | Command |
|---|---|---|
| `lint` | `apps/web` | `npm run lint:ci` |
| `unit_test` | `apps/web` | `npm run generate-enums && npx relay-compiler`, then `npm test` |
| `build_image` | `apps/web` | builds and (on PRs) scans/pushes the Docker image from `apps/web/Dockerfile` |
| `desktop_test` | `apps/desktop` | `make lint`, `make test`, plus an ARM64 cross-compile check |
| `static` | repo-wide | YAML lint, `actionlint`, `shellcheck` on `apps/desktop/scripts/*.sh`, `tauri.conf.json` parse check |

For environment setup needed before running any of these locally (Node version, `npm ci`, etc.), see the repository's general development setup documentation.
