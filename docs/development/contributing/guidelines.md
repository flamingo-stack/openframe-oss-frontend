## Contributing Guidelines

OpenFrame OSS Frontend (`flamingo-stack/openframe-oss-frontend`) is the Next.js + React + TypeScript web client for the OpenFrame platform, plus a Tauri desktop shell (`apps/desktop`) and a Capacitor mobile shell (`apps/mobile`). Most contributions land in `apps/web`, which publishes the `openframe_console` cargo artifact used by the desktop shell and consumes `@flamingo-stack/openframe-frontend-core` (pinned via a `pkg.pr.new` tarball URL in `apps/web/package.json`) from the OpenFrame OSS Library repository.

> This project does not use GitHub Issues or GitHub Discussions. Questions and proposals are handled on the OpenMSP Slack community: https://www.openmsp.ai/ (invite: https://join.slack.com/t/openmsp/shared_invite/zt-36bl7mx0h-3~U2nFH6nqHqoTPXMaHEHA). Pull requests on this repository (https://github.com/flamingo-stack/openframe-oss-frontend/pulls) remain the mechanism for proposing code changes.

---

### Table of Contents

- [Code style and conventions](#code-style-and-conventions)
- [Branch naming and PR process](#branch-naming-and-pr-process)
- [Commit message format](#commit-message-format)
- [Review checklist](#review-checklist)

---

## Code style and conventions

### Tooling: ESLint + Prettier (not Biome)

The web app (`apps/web`) lints with ESLint and formats with Prettier. Biome is explicitly retired — `.vscode/extensions.json` lists `biomejs.biome` under `unwantedRecommendations`, and `.vscode/settings.json` sets `"biome.enabled": false` with a comment explaining it is left off so a globally installed Biome extension does not fight the workspace.

Configuration lives in:

- `apps/web/eslint.config.mjs` — the fast pass, no type-aware rules. This is what the editor loads and what `npm run lint` runs.
- `apps/web/eslint.types.mjs` — the type-aware half, extends the fast pass. Run via `npm run lint:types`.
- `apps/web/eslint.ci.mjs` — the exact set CI blocks on (used by the pre-commit hook and by `npm run lint:ci`).
- `apps/web/eslint.cycles.mjs` — import-cycle checks (`npm run lint:cycles`).
- `apps/web/prettier.config.mjs` — re-exports the shared preset from `@flamingo-stack/openframe-frontend-core/eslint-config/prettier` (120 columns, single quotes, trailing commas, avoided arrow parens — chosen to reproduce the outgoing Biome formatter byte-for-byte) plus Tailwind class sorting.

Almost every rule comes from `@flamingo-stack/openframe-frontend-core/eslint-config` — the same shared config the core library and other Flamingo frontends load. Do not restate a rule locally; only what is genuinely specific to this repository belongs in `apps/web/eslint.config.mjs`, and each local block in that file documents *why* it exists (for example the `openframe-frontend/hydrate-from-browser-storage` block explains why several files read `localStorage`/`sessionStorage` inside an effect rather than in render, to avoid a hydration mismatch against this app's static export).

Layer order in `apps/web/eslint.config.mjs` is load-bearing: `next` first (carries the base config), `relay` and `tests` are additive, and `prettierCompat` is loaded **last** so it always wins over any stylistic rule a future preset release might add.

Inline `eslint-disable` comments do not work in this repository: the shared config sets `noInlineConfig`, so every inline disable is reported as an error. A finding is either fixed, or it is carried by a named, `files`-scoped override block in `apps/web/eslint.config.mjs` that states the reason — follow that pattern (see the `openframe-frontend/contravariant-filter-fn`, `openframe-frontend/store-mirror-cycle`, and `openframe-frontend/control-chars-are-the-payload` blocks for examples of a well-documented, narrowly scoped exemption) rather than adding a bare disable comment.

### Commands

Run these from `apps/web`:

```bash
npm run lint          # fast pass (what the editor and npm run lint use)
npm run lint:fix       # fast pass, applies autofixes
npm run lint:types     # type-aware rules, needs a larger heap (NODE_OPTIONS=--max-old-space-size=8192)
npm run lint:cycles    # import-cycle check
npm run format         # prettier --check .
npm run format:fix     # prettier --write .
npm run type-check     # tsc --noEmit
npm test               # vitest run && node --test src/lib/*.test.mjs
```

The editor (`.vscode/settings.json`) runs ESLint against `apps/web` specifically (`eslint.workingDirectories`), formats on save with Prettier (`esbenp.prettier-vscode`), and applies ESLint autofixes on save via `editor.codeActionsOnSave: { "source.fixAll.eslint": "explicit" }`. `eslint.format.enable` is deliberately off: turning it on would make "Format Document" run `eslint --fix` instead of Prettier, which (because the shared config spreads `eslint-config-prettier` last) formats nothing and looks exactly like format-on-save being broken.

### TypeScript

`apps/web/tsconfig.json` targets ES6 with `strict: true`, `moduleResolution: bundler`, `jsx: react-jsx`, and the `@/*` path alias resolving to `./src/*`. Use that alias for intra-app imports rather than long relative paths.

### Design-system and data-fetching conventions enforced by the active code review rules

These rules are actively enforced in this repository's code review and should be followed when writing new code (see the full catalog in `get_code_rules` for this repository):

- **Use the design-system component, not the raw HTML element** (`HTML-001`, `MULTIPLA-002-3`, `MULTIPLA-003`): `Button`, `Input`, `Select`, `Textarea`, `Table`, `Modal`, `Badge`, `Card`, `Image`, `Link`, and hooks such as `useToast` come from `@flamingo-stack/openframe-frontend-core/components/ui` or `@flamingo-stack/openframe-frontend-core/hooks` — do not reimplement them locally or drop to a raw `<button>`/`<input>`. The one documented exception in this repository is `chat-preview-logo.tsx`, whose static SVG logo is exempted from `@next/next/no-img-element` because it is caller-sized through `className` and `next/image` does not optimize SVG.
- **Do not re-declare an export the design system already publishes** (`LIB-001`): a new hook or utility whose short name matches a design-system export should import that export instead of re-implementing it.
- **Fetch only what the screen renders** (`DATAFETCH-001`): lists, tables, grids and pickers should request the current page or next cursor batch, not the whole collection; counts come from the API, not from loading everything to count it on the client.
- **Search, filter, sort and page server data on the backend** (`DATAFETCH-002`): no `.filter()`/`.includes()`/client-side TanStack table models over server-sourced rows; send the query to the API and render what it returns.
- **No duplicate definitions** (`DUP-001`): a new or changed exported definition should not structurally duplicate one that already exists elsewhere in the organization — reuse or extract a shared helper, or explain in the PR why a second copy is required.
- **An added import must resolve** (`IMPORT-001`): to a local file (via `@/*`), a declared dependency, or a symbol another managed repository publishes.

### Tests

Unit tests run with Vitest (`apps/web/vitest` via `npm test`) plus a small Node-native suite (`src/lib/*.test.mjs`, run with `node --test`, invoked by `npm run test:node`). The ESLint config carves out `**/*.test.mjs` from the Vitest-only rules (`vitest/no-import-node-test`, `vitest/expect-expect`, `vitest/valid-expect`) precisely because those three files use `node:test`, not Vitest.

### Desktop and mobile shells

`apps/desktop` (Tauri/Rust) and `apps/mobile` (Capacitor) have their own build scripts (`apps/desktop/scripts/make-placeholder-web.mjs`, `apps/mobile/scripts/build-web.sh`, `apps/mobile/scripts/inject-env.mjs`, etc.) but no JS/TS lint gate in the pre-commit hook described below. The desktop Rust code is linted and tested via `make lint` / `make test` (invoked by the `desktop_test` job in `.github/workflows/test.yml`) and uses `clippy`/`rustfmt`.

---

## Branch naming and PR process

### Branches

No single enforced branch-naming scheme is defined in this repository's workflows beyond two conventions visible in CI:

- The default branch is `main` — the release workflow (`.github/workflows/release.yml`) builds and (on manual dispatch) releases from pushes to `main`.
- Automated documentation pull requests use the `code-documentation/` branch prefix (`DOCS_BRANCH_PREFIX` in `.github/workflows/code-documentation.yml`); do not reuse that prefix for manual work.
- Stale branches are swept automatically: `.github/workflows/cleanup.yml` runs daily and deletes any unprotected branch with no commits in the last 60 days. Keep your feature branch active (or merge/delete it) if you intend to come back to it.

Name branches descriptively by the change they carry (for example a short `area/short-description` form matching the feature folder you are touching, such as `devices/...` or `mingo/...`, mirroring the domain folders under `apps/web/src/app/(app)/`), since CI's `dorny/paths-filter`-based `changes` job in `.github/workflows/test.yml` and `.github/workflows/release.yml` decides which jobs run based on the **paths you touch**, not the branch name: a change confined to `apps/desktop/**` skips the web lint/test/build jobs, and vice versa.

### Opening a pull request

1. Branch from `main`.
2. Make your change under the appropriate app (`apps/web`, `apps/desktop`, or `apps/mobile`).
3. Run the relevant local checks before pushing (see [Code style and conventions](#code-style-and-conventions)); the pre-commit hook (`.husky/pre-commit`) also runs a scoped subset automatically on `git commit` for any staged `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs` file inside `apps/web`:
   - `eslint --config eslint.ci.mjs --no-warn-ignored --max-warnings 0` over the staged files.
   - `prettier --check --ignore-unknown` over the staged files.
   - `tsc --noEmit --pretty false`, filtered to diagnostics anchored to a staged file.
   - The hook refuses to run (and asks you to `git add` the rest, or commit separately) when a staged file also carries further **unstaged** edits, since checking working-tree content that differs from what would be committed would validate the wrong thing.
4. Open the pull request against `main` at https://github.com/flamingo-stack/openframe-oss-frontend/pulls.
5. CI (`.github/workflows/test.yml`) runs on `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`, `closed`) and on `merge_group`. Jobs are gated by what changed:
   - `scan` — Trivy code scan, runs for every open PR.
   - `changes` — path filter deciding whether `web` and/or `desktop` jobs run (skipped entirely for a draft or closed PR).
   - `static` — repo-wide, ungated: YAML lint, `actionlint`, `shellcheck` over `apps/desktop/scripts/*.sh`, and a `tauri.conf.json` parse/consistency check.
   - `lint` — `npm run lint:ci` (web changes only).
   - `unit_test` — generates Relay artifacts/enums, then `npm test` (web changes only).
   - `build_image` — builds (and, for `pull_request` events, scans and pushes) the frontend Docker image from `apps/web/Dockerfile`, tagged `pr-<number>` (web changes only).
   - `desktop_test` — `make lint` and `make test` on macOS and Windows runners, plus an ARM64 cross-compile check (desktop changes only).
   - `all-checks` — the required status; it fails if any needed job failed or was cancelled.
   - `cleanup` — removes the PR's pushed container images once the PR closes.
6. A merge requires the CODEOWNERS teams to review: `.github/CODEOWNERS` assigns `*` (everything) to `@flamingo-stack/frontend-engineers`, `@flamingo-stack/tech-leads`, and `@flamingo-stack/tech-heads-of`, with `/apps/desktop/src-tauri/` additionally owned by `@flamingo-stack/client-engineers`, and `/.github/CODEOWNERS` itself owned by `@flamingo-stack/devops-engineers`.
7. An automated review can also be requested on an open PR by commenting `@flamingo-review` (incremental, since the last reviewed commit) or `@flamingo-review full` (re-reads the whole cumulative diff), or by checking the box in the bot's summary comment. This review enforces the active rule catalog described in [Review checklist](#review-checklist) below; it is not a substitute for human review from a CODEOWNERS team.
8. Once approved and green, merge into `main`. A push to `main` (outside `apps/mobile/**`) triggers `.github/workflows/release.yml`, which resolves a version, builds the frontend and desktop artifacts per path filter, and (on a manual `workflow_dispatch` only) creates a GitHub Release — automatic release creation on a plain push is intentionally disabled.

### Mentioning related work

Since this project does not use GitHub Issues, reference related Slack discussion or context in the PR description rather than linking an issue number.

---

## Commit message format

No commit-message linter (commitlint, conventional-commits enforcement, etc.) is configured in this repository's `.husky/pre-commit` hook or CI workflows. `.husky/pre-commit` validates **content** (lint, format, type-check) on staged files, not the commit message text.

In the absence of an enforced format, follow these practical conventions drawn from how the repository itself is organized and reviewed:

- Write a concise, imperative summary line (for example, "Add customer AI configuration guardrails tab" rather than "Added" or "Adding").
- Scope the message to the domain folder you changed when useful (for example, prefixing with `devices:`, `mingo:`, `knowledge-base:` mirrors the `apps/web/src/app/(app)/<domain>/` structure and helps reviewers and `git log` searches).
- Keep a commit scoped to one logical change so the pre-commit hook's staged/unstaged-content guard and the PR's path-based CI gating (`changes` job) stay meaningful — a commit that mixes unrelated `apps/web` and `apps/desktop` edits triggers both sets of CI jobs for no benefit to either.
- Avoid inline `eslint-disable` comments in the commit's diff (they are hard errors under this repository's config); if a rule genuinely does not apply, add a named, justified override block to `apps/web/eslint.config.mjs` instead and explain the reasoning in the commit message or PR description, following the style already used there (see the file for examples such as `openframe-frontend/relay-hook-names-collide-with-react-query` or `openframe-frontend/immer-drafts`).
- Reference the OpenMSP Slack discussion instead of an issue number, since GitHub Issues are not used.

---

## Review checklist

Before requesting review, and again before merging, confirm:

### Local checks pass

- [ ] `npm run lint` (or at minimum `npm run lint:ci`, the set CI blocks on) is clean.
- [ ] `npm run type-check` (`tsc --noEmit`) is clean.
- [ ] `npm run format` reports no Prettier diffs (or run `npm run format:fix`).
- [ ] `npm test` passes (Vitest + the `node --test` suite).
- [ ] For desktop changes: `make lint` and `make test` pass (mirrors the `desktop_test` CI job).

### Code conventions

- [ ] No raw HTML primitives (`<button>`, `<input>`, etc.) where a design-system component exists — use `@flamingo-stack/openframe-frontend-core/components/ui` (`HTML-001`, `MULTIPLA-003`).
- [ ] No local reimplementation of a component, hook, or utility already published by `@flamingo-stack/openframe-frontend-core` (`LIB-001`, `MULTIPLA-002-3`).
- [ ] List/table/grid/picker UIs fetch only the visible page or next cursor batch, not the whole collection, and counts come from the API (`DATAFETCH-001`).
- [ ] Search, filter, sort, and pagination over server-sourced data are delegated to the backend/API — no client-side `.filter()`, fuzzy matching, or TanStack client-mode table models over server rows (`DATAFETCH-002`).
- [ ] No inline `eslint-disable` comments; any necessary rule exemption is a named, justified, `files`-scoped override added to `apps/web/eslint.config.mjs`.
- [ ] Any new or changed exported definition does not structurally duplicate an existing one elsewhere in the organization (`DUP-001`) — check with the code graph if unsure, and prefer extracting a shared helper.
- [ ] New imports resolve to a local file (via the `@/*` alias), a declared dependency, or a symbol another managed repository actually publishes (`IMPORT-001`).

### Architecture and boundaries

- [ ] API/network calls stay out of the Api Client's concerns it does not own — `AuthApiClient` and `FleetApiClient` in `src/lib` centralize auth, token refresh, and base-URL resolution (see `../../reference/architecture/api-client/api-client.md`); new backend calls should go through the existing client layer rather than ad hoc `fetch`.
- [ ] Changes to shared stores (Zustand) or Relay-fed state respect the reference-stability and store/mirror patterns already documented inline in `apps/web/eslint.config.mjs` (for example, do not introduce a new `setState`-in-render pattern without the same reasoning the existing overrides carry).
- [ ] Changes affecting the published `openframe_console` cargo artifact or the dependency pin on `@flamingo-stack/openframe-frontend-core` are called out explicitly in the PR description, since no other repository is currently recorded as consuming this repository's artifacts, but the dependency on OpenFrame OSS Library is load-bearing.

### CI and release hygiene

- [ ] The PR does not add an automatic release trigger: GitHub Release creation must remain gated on `workflow_dispatch` only, never a plain push (see `.github/workflows/release.yml`).
- [ ] Any script a workflow downloads from the hub goes through the shared verification helper against the hub's manifest digest — never a hash pinned in the workflow YAML and never `curl | bash`.
- [ ] Workflow or script changes touching `.github/workflows/*.yml` or `apps/desktop/scripts/*.sh` keep `actionlint` and `shellcheck` (part of the `static` CI job) clean.
- [ ] CODEOWNERS teams relevant to the touched paths (per `.github/CODEOWNERS`) have had a chance to review before merge.
