import { defineConfig } from 'eslint/config';

import base from './eslint.config.mjs';

/*
 * What CI blocks a PR on: the fast pass, minus the one rule still carrying a
 * backlog.
 *
 * `relay/unused-fields` has 543 findings, inherited from the era when
 * `eslint.config.mjs` declared no `files:` patterns and therefore linted nothing
 * (see CLAUDE.md, Code Quality). Every other rule in the shared config is at
 * zero, so CI can hold that line today; this one cannot be cleared by a
 * mechanical pass — each finding is a decision about whether a query should stop
 * selecting a field or a consumer should start reading it through a fragment.
 *
 * It stays ON in `eslint.config.mjs`, which is what the editor and the
 * pre-commit hook load: a field you over-fetch in a file you are touching is
 * still reported where you can act on it. Only this config, and only CI, is
 * blind to it — so the count can drain without a PR being blocked on somebody
 * else's.
 *
 * Delete this file once the backlog reaches zero; `npm run lint` is then the
 * command CI should run.
 */
export default defineConfig([
  ...base,
  {
    name: 'openframe-frontend/ci-relay-unused-fields-backlog',
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: { 'relay/unused-fields': 'off' },
  },
]);
