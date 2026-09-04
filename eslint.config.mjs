import next from '@flamingo-stack/openframe-frontend-core/eslint-config/next';
import prettierCompat from '@flamingo-stack/openframe-frontend-core/eslint-config/prettier-compat';
import relay from '@flamingo-stack/openframe-frontend-core/eslint-config/relay';
import tests from '@flamingo-stack/openframe-frontend-core/eslint-config/tests';
import { defineConfig } from 'eslint/config';

import openframeRules from './eslint-rules/react-hook-form-needs-no-memo.mjs';

/*
 * The fast pass — no type-aware rules. This is what the editor loads (see
 * .vscode/settings.json) and what `npm run lint` runs; the type-aware half
 * lives in eslint.types.mjs and extends this file, so there is one source of
 * truth rather than two.
 *
 * Every rule comes from the shared config in
 * `@flamingo-stack/openframe-frontend-core/eslint-config` — the same one the
 * library and the other Flamingo frontends load. Nothing is restated here;
 * only what is genuinely local to this repo belongs below, and each block says
 * why it exists.
 *
 * Layer order is load-bearing: `next` first (it carries the base), `relay` and
 * `tests` are additive, `prettierCompat` LAST because its only job is to win
 * over any stylistic rule a future preset release adds.
 *
 * Inline `eslint-disable` comments are inert here — the shared config sets
 * `noInlineConfig` and reports each one as an error. A finding is fixed, or it
 * is carried by a named `files:`-scoped block below that states its reason.
 */
export default defineConfig([
  ...next,
  ...relay,
  ...tests,

  {
    // `src/lib/*.test.mjs` runs under `node --test`, not Vitest (the `test:node`
    // script). `no-import-node-test` assumes every test file is a Vitest one and
    // its FIXER rewrites `import { test } from 'node:test'` to a vitest import —
    // which would break these three files on the next `eslint --fix`. The other
    // two Vitest rules simply have nothing to say about a node:test file.
    name: 'openframe-frontend/node-test-runner',
    files: ['**/*.test.mjs'],
    rules: {
      'vitest/no-import-node-test': 'off',
      'vitest/expect-expect': 'off',
      'vitest/valid-expect': 'off',
    },
  },

  {
    // Reading a browser-only value AFTER mount, which is the one thing an effect
    // is for here and the one thing render cannot do.
    //
    // Every state below is seeded from `localStorage` / `sessionStorage` / a
    // shell-injected global. None of it exists during the prerender this app
    // ships (`output: 'export'`), so reading it in render — or in a lazy
    // `useState` initializer, which also runs on the server — makes the two
    // passes disagree and costs the whole subtree to a hydration mismatch. The
    // `board-columns-cache` and `onboarding-top-bar-cache` modules spell this out
    // at length, and `app-layout`'s trial-bar comment names the same trade.
    //
    // The rule's own guidance ("update external systems", "subscribe to an
    // external system") is exactly what these do — it just cannot tell a
    // hydration read from a cascading one. The extra render is the price of
    // rendering the same markup on both sides, and it is paid once per mount.
    name: 'openframe-frontend/hydrate-from-browser-storage',
    files: [
      'src/app/(app)/tickets/components/board-columns-cache.ts',
      'src/app/components/onboarding-top-bar-cache.tsx',
      'src/app/(auth)/auth/check-email/page.tsx',
      'src/app/account-deleted/page.tsx',
      'src/app/components/app-layout.tsx',
      'src/lib/nats/nats-app-config.tsx',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },

  {
    // Fetch-or-subscribe on mount, where the `setState` the rule sees is one or
    // two calls deep inside the thing being started.
    //
    // These are not derived state: `fetchActiveSecret`, `loadData`,
    // `fetchConfiguration`, `subscribeToDialog` and the schedule picker's
    // `fetchQuery` all reach the network or a NATS subscription, and each writes
    // its own loading/result state from the callback it registers. The rule flags
    // the synchronous call that STARTS them, because it cannot see that the
    // writes happen later.
    //
    // `use-auth`'s is the same shape one step further out — a mount latch that
    // reports the auth bootstrap finished. And `use-mingo-dialog-selection`
    // folds approval verdicts out of the fetched history into the same state the
    // approve/reject buttons write, so it cannot become a render-time
    // derivation without splitting one piece of state in two.
    //
    // Migrating these to react-query (which is where this app is heading, see
    // CLAUDE.md) is the real fix and a feature change, not a lint one.
    name: 'openframe-frontend/start-work-on-mount',
    files: [
      'src/app/(app)/devices/hooks/use-registration-secret.ts',
      'src/app/(app)/mingo/hooks/use-mingo-realtime-subscription.ts',
      'src/app/(app)/mingo/hooks/use-mingo-dialog-selection.ts',
      'src/app/(app)/scripts/schedule/hooks/use-schedule-scripts-autocomplete.ts',
      'src/app/(app)/settings/components/tabs/sso-configuration.tsx',
      'src/app/(app)/settings/hooks/use-ai-configuration.ts',
      'src/app/(auth)/auth/hooks/use-auth.ts',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },

  {
    // Reference reconciliation, and the one place a ref in render is the point.
    //
    // The chat list is memoized by the core library on REFERENCE equality per
    // message, so a mapper that rebuilds every row on each realtime chunk defeats
    // it and re-renders the whole thread — collapsing any open menu or card in it.
    // Both hooks below therefore carry the previous render's mapped objects (a
    // Map in `use-mingo-chat`, a WeakMap keyed by the source row in
    // `use-mingo-unified-chat-state`) and hand the old instance back when the new
    // one is structurally identical.
    //
    // That cache has to be read and written where the mapping happens, which is
    // render. State cannot hold it: writing it would schedule another render on
    // every chunk, which is the cost this exists to avoid. The React Compiler's
    // own memoization does not cover it either — it caches the mapper's RESULT,
    // not the identity of the objects inside the array it returns.
    //
    // `remote-desktop/page` is the same rule for a different reason: it builds its
    // actions menu by passing a handler object to `createActionsMenuGroups`, and
    // one of those handlers closes over `desktopRef` to toggle view-only. The rule
    // cannot see that the handler only runs on click, so it reports the call.
    name: 'openframe-frontend/reference-stability-caches',
    files: [
      'src/app/(app)/mingo/hooks/use-mingo-chat.ts',
      'src/app/(app)/mingo/hooks/use-mingo-unified-chat-state.ts',
      'src/app/(app)/devices/details/remote-desktop/page.tsx',
    ],
    rules: { 'react-hooks/refs': 'off' },
  },

  {
    // `static-components` targets a component DECLARED inside render, whose state
    // resets every time the parent re-renders. These four do the opposite: they
    // LOOK UP an existing module-level component in a registry — `getTabComponent`
    // resolves the tab id from a static table, `innerFor` the mention kind — so
    // the component is stable for a stable key, and a changed key SHOULD remount
    // (switching tabs is meant to be a fresh mount, not a re-render).
    //
    // The rule has no way to see through a registry lookup, and the alternative is
    // a hand-written switch over every tab and mention kind at each call site.
    // Same exemption, same reasoning, as the core library's own icon-registry
    // block.
    name: 'openframe-frontend/component-registry-lookup',
    files: [
      'src/app/(app)/customers/page.tsx',
      'src/app/(app)/monitoring/page.tsx',
      'src/app/(app)/settings/components/settings-tab-content.tsx',
      'src/app/(app)/mingo/context/mention-chips/relay-mention-chips.tsx',
    ],
    rules: { 'react-hooks/static-components': 'off' },
  },

  {
    // The ONE `any` left in src, and it is load-bearing. `multiSelectFilterFn` has
    // to be assignable to a `ColumnDef<T>['filterFn']` for every concrete row type
    // a table declares. `TData` is CONTRAVARIANT on a filter, so the core library's
    // own `FilterFn<unknown>` is not a supertype of `FilterFn<UiLogEntry>`, and
    // `ColumnDef<never>` fails the other direction (measured: 21 type errors across
    // the logs tables). `any` is what makes one shared filter fit ~15 typed columns;
    // the predicate only reads the cell value, so nothing is actually widened.
    // Revisit if the core library ever exports `FilterFn` itself.
    name: 'openframe-frontend/contravariant-filter-fn',
    files: ['src/lib/table-filters.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },

  {
    // `must-colocate-fragment-spreads` wants the module that SPREADS a fragment to
    // be the module that renders its consumer. Neither of these two shapes can be:
    //
    //  - `src/graphql/**` holds operation and `@inline` fragment definitions and
    //    renders nothing at all. That is the architecture CLAUDE.md mandates: a row
    //    shape is declared once as an `@inline` fragment, spread by every operation
    //    that needs it, and read by a plain mapper function via `readInlineData`
    //    (`device-{row,selector,}-fields.ts` compose into a ladder this way). The
    //    consumer is a function in another file by construction.
    //  - `subscription-settings-view` spreads the device-plan-picker's fragments
    //    and hands the refs down through PaywallBody and DeviceManagementCard to
    //    the picker that reads them. Passing a fragment ref through an intermediate
    //    component is ordinary Relay; the rule only recognises a direct render.
    //
    // Everywhere else the rule stays on, which is where it earns its place: a
    // component-owned fragment spread far from the component that reads it is how
    // Relay codebases rot.
    name: 'openframe-frontend/fragment-definitions-render-nothing',
    files: [
      'src/graphql/**/*.ts',
      'src/app/(app)/settings/billing-usage/subscription/components/subscription-settings-view.tsx',
    ],
    rules: { 'relay/must-colocate-fragment-spreads': 'off' },
  },

  {
    // `mirror` (a reducer mirror built at module scope) and the zustand store below
    // it reference each other: the mirror's `onSnapshot` writes into the store, and
    // the store's actions drive the mirror. Both references are made from callbacks
    // that run long after the module has finished evaluating, so the cycle is real
    // in the dependency graph and impossible in time — and no ordering of the two
    // declarations removes it, because whichever goes first names the other.
    name: 'openframe-frontend/store-mirror-cycle',
    files: [
      'src/app/(app)/mingo/stores/mingo-messages-store.ts',
      'src/app/(app)/tickets/stores/ticket-details-store.ts',
    ],
    rules: { '@typescript-eslint/no-use-before-define': 'off' },
  },

  {
    // `waitForOnline` builds a timer and a connectivity subscription that each have
    // to be able to cancel the other, so one of them is always named above its own
    // definition. `prefer-const` additionally wants `unsub` to be a `const`, which
    // is exactly the bug the file's own comment describes: `subscribeConnectivity`
    // invokes its listener SYNCHRONOUSLY, so on an already-online link the callback
    // runs while the binding is still in its temporal dead zone. The `let` plus the
    // `settled` flag is the fix, not the defect.
    name: 'openframe-frontend/connectivity-race',
    files: ['src/lib/relay/environment.ts'],
    rules: { 'prefer-const': 'off', '@typescript-eslint/no-use-before-define': 'off' },
  },

  {
    // `sanitizeName` strips the bytes Windows forbids in a filename, `\x00-\x1F`
    // among them. `no-control-regex` assumes a control character in a pattern is a
    // typo; here the control characters ARE the input being rejected, and spelling
    // the range some other way to satisfy the rule would make a
    // security-relevant filter harder to read.
    name: 'openframe-frontend/control-chars-are-the-payload',
    files: ['src/lib/meshcentral/file-operations.ts'],
    rules: { 'no-control-regex': 'off' },
  },

  {
    // The MSP logo is a static SVG served from /public, and the component's whole
    // contract is that the CALLER sizes it through `className`. `next/image`
    // refuses to render without intrinsic width/height and does not optimize SVG
    // anyway (that needs `dangerouslyAllowSVG`), so routing this through it would
    // add a constraint and buy nothing.
    name: 'openframe-frontend/static-svg-logo',
    files: ['src/app/(app)/settings/ai-settings/components/previews/chat-preview-logo.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },

  {
    // `relay/generated-typescript-types` matches on the HOOK NAME alone. This app
    // runs react-relay and TanStack React Query side by side on purpose (see
    // CLAUDE.md: Relay for `/api/graphql`, react-query for REST and the
    // `/chat/graphql` service), and both export `useQuery` and `useMutation` — so
    // the rule demanded a Relay artifact type on 51 react-query call sites that
    // have no Relay operation to name, against 9 real Relay ones.
    //
    // The 9 were fixed rather than exempted (relay-items, run-script-select-step,
    // use-tag-mutations all carry their generated types now). What is off here is
    // a check that cannot tell the two libraries apart; the loss is small, because
    // a Relay hook without its type argument does not silently do the wrong thing
    // — it hands back untyped data that the consuming code fails to compile
    // against. Revisit if the plugin ever learns to resolve the import.
    name: 'openframe-frontend/relay-hook-names-collide-with-react-query',
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: { 'relay/generated-typescript-types': 'off' },
  },

  {
    // These four stores run their `set` through zustand's `immer` middleware, so
    // the `state` their updaters receive is an immer DRAFT: writing to it is the
    // middleware's entire contract, and the produced value is a new frozen state
    // object, not a mutated caller argument. `no-param-reassign` cannot tell a
    // draft from a real parameter, and the alternative — hand-rolling the spread
    // for every nested update — is what immer was added here to delete.
    //
    // Listed file by file rather than as `src/**/stores/**` on purpose: the
    // tickets and mingo stores use plain `create()` (no immer), where a write to
    // `state` WOULD be the bug this rule exists to catch, and they stay covered.
    // Note the options are restated whole because ESLint replaces them, so the
    // shared config's `[Rr]ef$` carve-out has to be repeated here.
    name: 'openframe-frontend/immer-drafts',
    files: [
      'src/app/(auth)/auth/stores/auth-store.ts',
      'src/stores/devices-store.ts',
      'src/stores/onboarding-store.ts',
      'src/stores/feature-flags-store.ts',
    ],
    rules: {
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: ['state'],
          ignorePropertyModificationsForRegex: ['[Rr]ef$'],
        },
      ],
    },
  },

  {
    // `scripts/server-entry.js` is the Docker entrypoint: plain CommonJS run by
    // `node`, never bundled, never type-checked. The shared base already exempts
    // `**/scripts/**` from `no-require-imports`, but `eslint-config-next/typescript`
    // is spread AFTER the base and re-declares the whole
    // `typescript-eslint/recommended` set, which puts the rule back at `error` for
    // every file. This restates the base's own decision after that preset, the same
    // way the shared `flamingo/next/severities` block restates the others.
    //
    // `no-param-reassign` goes with it, and only for this file: the workaround IS
    // a monkey-patch. It replaces the handler inside `http.createServer`'s own
    // `args`, then swaps `res.writeHead` / `res.write` / `res.end` and fixes
    // `res.statusCode` on the response Node handed it — writing to those objects
    // is the entire mechanism, and there is no version of it that leaves its
    // arguments alone. Scoped to the one file so an ordinary helper under
    // `scripts/` still cannot mutate what it was passed.
    name: 'openframe-frontend/commonjs-scripts',
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    name: 'openframe-frontend/http-response-patch',
    files: ['scripts/server-entry.js'],
    rules: { 'no-param-reassign': 'off' },
  },

  {
    // The `testing-library` rules default to "aggressive module reporting": with
    // no utils module declared they treat ANY `render`/`act` call as Testing
    // Library's, even in a file that never imports it. `script-editor-view.test`
    // is exactly that — a hand-rolled `createRoot()` harness using React's own
    // `act` — and `no-unnecessary-act` fired on its `root.render(...)`.
    // Declaring the module as 'off' narrows the plugin to real imports from
    // `@testing-library/*`; every rule stays on for the files that do use it.
    // (The shared config already does the same for `custom-renders`.)
    name: 'openframe-frontend/testing-library-imports-only',
    files: ['**/*.{test,spec}.{js,mjs,cjs,jsx,ts,tsx}', '**/__tests__/**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    settings: { 'testing-library/utils-module': 'off' },
  },

  {
    // react-hook-form mutates `control` and proxies `formState`, which the React
    // Compiler's memoization cannot observe (stale `watch()`, dead `reset()`), and its
    // own diagnostics cannot catch it. Local rather than shared: it encodes this repo's
    // dependency set, not a React rule. Drop it, and the directives, on react-hook-form
    // 7.75 + React 19.2.5 — see the rule's header.
    name: 'openframe-frontend/react-hook-form-react-compiler',
    files: ['**/*.{ts,tsx}'],
    plugins: { openframe: openframeRules },
    rules: { 'openframe/react-hook-form-needs-no-memo': 'error' },
  },

  {
    // The two extra lint configs are `eslint.*.mjs`, not `*.config.*`, so they
    // fall outside the shared devDependencies allowlist and every import they
    // make (`eslint/config`) reads as a production dependency. They are lint
    // tooling; nothing they import ships.
    name: 'openframe-frontend/lint-configs',
    files: ['eslint.*.mjs'],
    rules: { 'import/no-extraneous-dependencies': ['error', { devDependencies: true }] },
  },

  ...prettierCompat,
]);
