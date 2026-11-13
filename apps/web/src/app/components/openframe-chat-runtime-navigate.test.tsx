/**
 * Where the host's `navigate` sends a link, in order: a mounted document viewer swaps in place, a same-origin address
 * soft-navigates, anything else is left to the lib to open. A record's url carries no doc path, so the address alone has
 * to reach the viewer (contract 3.4): a composer hands back `/help-center/knowledge-base/<tree path>` and the navigator
 * registered at that route is what finds the node. Mounted through the app's own layout, so what is proven is what runs.
 */
import { useDocumentTree, useDocNavigation } from '@flamingo-stack/openframe-frontend-core/components/docs';
import { type ChatRuntime, ChatRuntimeContext } from '@flamingo-stack/openframe-frontend-core/contexts';
import { act, type ReactNode, useContext, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ push: vi.fn(), selectNode: vi.fn() }));

import { useManhattanCentreStore } from './manhattan-shell/manhattan-centre-store';

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
vi.mock('./app-layout', () => ({ AppLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('./mingo-dialog-param-bridge', () => ({ MingoDialogParamBridge: () => null }));
vi.mock('./shell-navigator-registrar', () => ({ ShellNavigatorRegistrar: () => null }));

const KB = '/help-center/knowledge-base';
const NODES = new Set(['openframe-cli/getting-started/quick-start.md', 'openframe-cli/README.md']);

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

/** The lib's own tree, what `DocsHubPage` runs on the Knowledge Base page. */
function RealTree({ onSelected }: { onSelected: (path: string) => void }) {
  const { selectedPath } = useDocumentTree({ structureEndpoint: '/s', contentEndpoint: '/c', baseRoute: KB });
  useEffect(() => {
    onSelected(selectedPath);
  }, [selectedPath, onSelected]);
  return null;
}

function Probe({ onRuntime }: { onRuntime: (runtime: ChatRuntime | null) => void }) {
  const runtime = useContext(ChatRuntimeContext);
  useEffect(() => onRuntime(runtime));
  return null;
}

let root: Root | null = null;

async function mount(viewer: ReactNode = <Viewer />) {
  const { default: AppGroupLayout } = await import('../(app)/layout');
  const seen: { runtime: ChatRuntime | null } = { runtime: null };
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root?.render(
      <AppGroupLayout>
        {viewer}
        <Probe
          onRuntime={runtime => {
            seen.runtime = runtime;
          }}
        />
      </AppGroupLayout>,
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

  it('swaps the real tree the Knowledge Base page runs on, and the address follows', async () => {
    const tree = {
      success: true,
      data: [{ id: 'guide', name: 'Guide', slug: 'guide', path: 'openframe-cli/guide.md', type: 'file' }],
    };
    const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(tree)),
    );
    const selected: string[] = [];
    const navigate = await mount(<RealTree onSelected={path => selected.push(path)} />);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      expect(navigate({ href: `${KB}/openframe-cli/guide.md`, path: null })).toBe(true);
    });
    expect(selected.at(-1)).toBe('openframe-cli/guide.md');
    expect(window.location.pathname).toBe(`${KB}/openframe-cli/guide.md`);
    expect(mocks.push).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('leaves an address with a fragment or a query to the router: the swap would lose the place it names', async () => {
    const navigate = await mount();
    const target = `${KB}/openframe-cli/getting-started/quick-start.md?from=chat#install`;

    expect(navigate({ href: target, path: null })).toBe(true);
    expect(mocks.selectNode).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(target);
  });

  it('takes the doc path a link hands it', async () => {
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

  // Manhattan v2: a chat covering the page brings the page a link leads to on screen, a swapped document included.
  it('brings the page on screen for a swapped document, from the address or the path, and for a routed page', async () => {
    const navigate = await mount();
    const requests = () => useManhattanCentreStore.getState().linkedPageRequests;
    const before = requests();

    navigate({ href: `${KB}/openframe-cli/README.md`, path: null });
    navigate({ href: 'https://www.flamingo.run/whatever', path: 'openframe-cli/README.md' });
    navigate({ href: `${KB}/not/in/the/tree.md`, path: null });
    expect(requests()).toBe(before + 3);

    navigate({ href: 'https://www.flamingo.run/blog/openframe-vs-atera', path: null });
    expect(requests()).toBe(before + 3);
  });

  it('leaves a cross-origin address to the lib, which opens it', async () => {
    const navigate = await mount();

    expect(navigate({ href: 'https://www.flamingo.run/blog/openframe-vs-atera', path: null })).toBe(false);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.selectNode).not.toHaveBeenCalled();
  });
});
