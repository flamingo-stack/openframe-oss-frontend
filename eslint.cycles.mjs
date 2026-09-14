import cycles from '@flamingo-stack/openframe-frontend-core/eslint-config/cycles';
import { defineConfig } from 'eslint/config';

import base from './eslint.config.mjs';

/*
 * `import/no-cycle` as its own stage — it walks the whole import graph, which
 * is too slow for the fast pass and too cheap to skip in CI.
 *
 * ★ MUST spread `...base` first. Spread standalone, the plugin cannot build an
 * export graph at all and reports zero cycles over any repo — a green check
 * that examined nothing. See the note in the shared `eslint-config/cycles.js`,
 * where exactly that cost the library a real 3-hop cycle through a barrel.
 */
export default defineConfig([...base, ...cycles]);
