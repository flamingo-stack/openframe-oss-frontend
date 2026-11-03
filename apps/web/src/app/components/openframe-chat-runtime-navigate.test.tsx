/**
 * Where the host's `navigate` sends a link, in order: a mounted document viewer swaps in place, a same-origin address
 * soft-navigates, anything else is left to the lib to open. A record's url carries no doc path, so the address alone has
 * to reach the viewer (contract 3.4): a composer hands back `/help-center/knowledge-base/<tree path>` and the navigator
 * registered at that route is what finds the node.
 */
import { DocNavigationProvider, useDocNavigation } from '@flamingo-stack/openframe-frontend-core/components/docs';
import { type ChatRuntime, ChatRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { act, useContext, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ push: vi.fn(), selectNode: vi.fn() }));

vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => '/help-center/knowledge-base',
}));
vi.mock('@/app/hooks/use-same-window-links', () => ({ useSameWindowLinks: () => false }));
vi.mock('@/app/(auth)/auth/hooks/use-auth-session', () => ({
  useAuthSession: () => ({ isReady: false, isAuthenticated: false }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useEmptyStateConfig: () => ({ config: {}, loaded: false }),
}));

const KB = '/help-center/knowledge-base';
const NODES = new Set(['openframe-cli/getting-started/quick start.md', 'openframe-cli/README.md']);

function Viewer() {
  const docNav = useDocNavigation();
  useEffect(
    () =>
      docNav.register({
        baseRoute: KB,
        findNodeByPath: path => (NODES.has(path) ? ({ path } as never) : null),
        selectNode: mocks.selectNode,
      }),
    [docNav],
  );
  return null;
}

function Probe({ onRuntime }: { onRuntime: (runtime: ChatRuntime | null) => void }) {
  const runtime = useContext(ChatRuntimeContext);
  useEffect(() => onRuntime(runtime));
  return null;
}

let root: Root | null = null;

async function mount() {
  const { OpenframeChatRuntimeProvider } = await import('./openframe-chat-runtime-provider');
  const seen: { runtime: ChatRuntime | null } = { runtime: null };
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root?.render(
      <DocNavigationProvider>
        <OpenframeChatRuntimeProvider>
          <Viewer />
          <Probe
            onRuntime={runtime => {
              seen.runtime = runtime;
            }}
          />
        </OpenframeChatRuntimeProvider>
      </DocNavigationProvider>,
    );
  });
  const navigate = seen.runtime?.navigation.navigate;
  if (!navigate) throw new Error('no navigate');
  return navigate;
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.selectNode.mockReset();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe('OpenframeChatRuntimeProvider navigate', () => {
  it('swaps the document in place from the address alone', async () => {
    const navigate = await mount();

    expect(navigate({ href: `${KB}/openframe-cli/README.md`, path: null })).toBe(true);
    expect(mocks.selectNode).toHaveBeenCalledWith({ path: 'openframe-cli/README.md' });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('reads the tree path as the tree keys it, with no query or fragment and decoded', async () => {
    const navigate = await mount();

    expect(
      navigate({ href: `${KB}/openframe-cli/getting-started/quick%20start.md?from=chat#install`, path: null }),
    ).toBe(true);
    expect(mocks.selectNode).toHaveBeenCalledWith({ path: 'openframe-cli/getting-started/quick start.md' });
  });

  it("takes a doc path it was handed, the old hub's doc rows", async () => {
    const navigate = await mount();

    expect(navigate({ href: 'https://www.flamingo.run/whatever', path: 'openframe-cli/README.md' })).toBe(true);
    expect(mocks.selectNode).toHaveBeenCalledWith({ path: 'openframe-cli/README.md' });
  });

  it('soft-navigates an in-app address the viewer does not hold', async () => {
    const navigate = await mount();

    expect(navigate({ href: `${KB}/not/in/the/tree.md`, path: null })).toBe(true);
    expect(mocks.selectNode).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(`${KB}/not/in/the/tree.md`);
  });

  it('leaves a cross-origin address to the lib, which opens it', async () => {
    const navigate = await mount();

    expect(navigate({ href: 'https://www.flamingo.run/blog/openframe-vs-atera', path: null })).toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.selectNode).not.toHaveBeenCalled();
  });
});
