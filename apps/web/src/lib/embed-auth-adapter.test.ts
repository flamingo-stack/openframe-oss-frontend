import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { runtimeEnv } from '@/lib/runtime-config';

const mode = vi.hoisted(() => ({ appMode: 'saas-tenant' }));
vi.mock('@/lib/runtime-config', async importOriginal => {
  const actual = await importOriginal<{ runtimeEnv: typeof runtimeEnv }>();
  return { ...actual, runtimeEnv: { ...actual.runtimeEnv, appMode: () => mode.appMode } };
});

async function load() {
  vi.resetModules();
  const [{ registerEmbedAuthAdapter }, { embedAuthedFetch, setEmbedAuthAdapter }] = await Promise.all([
    import('./embed-auth-adapter'),
    import('@flamingo-stack/openframe-frontend-core/utils'),
  ]);
  return { registerEmbedAuthAdapter, embedAuthedFetch, setEmbedAuthAdapter };
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Whether the lib's request went out signed by the app's adapter: only the adapter adds the client header. */
const sentByAdapter = () => new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).has('X-OpenFrame-Client');

// The first import transforms the inlined core lib, which can exceed the default test timeout.
beforeAll(async () => {
  await load();
}, 60_000);

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  const { setEmbedAuthAdapter } = await load();
  setEmbedAuthAdapter(null);
  mode.appMode = 'saas-tenant';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('registerEmbedAuthAdapter', () => {
  it('registers the adapter in a tenant mode, once for any number of callers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { registerEmbedAuthAdapter, embedAuthedFetch } = await load();

    registerEmbedAuthAdapter();
    registerEmbedAuthAdapter();
    await embedAuthedFetch('/content/api/ai-agents');

    expect(sentByAdapter()).toBe(true);
    // The lib warns when a registered adapter is overwritten.
    expect(warn).not.toHaveBeenCalled();
  });

  // The shared-auth host reads the hub's announcement cross-origin through the lib's `contentFetch`:
  // a plain `fetch` with no adapter, refused by `embedAuthedFetch`'s same-origin rule with one.
  it('registers nothing on the shared-auth host', async () => {
    mode.appMode = 'saas-shared';
    const { registerEmbedAuthAdapter, embedAuthedFetch } = await load();

    registerEmbedAuthAdapter();
    await embedAuthedFetch('/content/api/ai-agents');

    expect(sentByAdapter()).toBe(false);
  });
});
