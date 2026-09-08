import prettierCompat from '@flamingo-stack/openframe-frontend-core/eslint-config/prettier-compat';
import typeChecked from '@flamingo-stack/openframe-frontend-core/eslint-config/type-checked';
import { defineConfig, globalIgnores } from 'eslint/config';

import base from './eslint.config.mjs';

/*
 * The type-aware pass — floating promises, the unsafe-`any` family, misused
 * await. Its own stage rather than part of `npm run lint`, because it has to
 * build a TypeScript program: an order of magnitude slower, and it needs
 * `NODE_OPTIONS=--max-old-space-size=8192` (see the `lint:types` script).
 *
 * Extends the fast config instead of restating it.
 *
 * The ignores are not exemptions — every file below is still linted by the
 * fast pass. They are outside the TypeScript project (tsconfig.json includes
 * `src/**` plus the Next type shims only), so `projectService` cannot build a
 * program for them and reports a parse error instead of a finding.
 */
export default defineConfig([
  globalIgnores(['*.config.{js,mjs,ts,mts}', 'eslint.*.mjs', 'scripts/**', 'vitest.setup.ts', '**/*.mjs']),
  ...base,
  ...typeChecked,
  // Re-applied because typeChecked lands after the fast config's copy.
  ...prettierCompat,
]);
