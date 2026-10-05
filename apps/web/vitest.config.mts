import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const projectRoot = import.meta.dirname;

/**
 * Vitest — unit tests for the chat stream bridge (`src/lib/chat-stream-thread`,
 * `src/lib/use-chat-chunk-processor`) and anything else that carries logic
 * worth pinning.
 *
 * `include` deliberately covers only `.ts`/`.tsx`: the pre-existing
 * `src/lib/*.test.mjs` files run under `node --test` (`npm run test:node`) and
 * would fail here — they import `node:test`, not vitest.
 *
 * Environment is `jsdom` because the bridge imports the core library barrel,
 * which reaches for browser globals at module scope even in the non-component
 * modules.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    server: {
      deps: {
        // Run the core library through Vite's resolver instead of Node's raw
        // ESM loader. Its bundle imports Next entry points extensionlessly
        // (`next/link`, `next/navigation`), which Node rejects under ESM —
        // Vite resolves them the same way the Next build does. Which chunk a
        // given import lands in shifts between library builds, so pinning
        // individual specifiers would break again on the next rebuild.
        inline: [/@flamingo-stack\/openframe-frontend-core/],
      },
    },
  },
});
