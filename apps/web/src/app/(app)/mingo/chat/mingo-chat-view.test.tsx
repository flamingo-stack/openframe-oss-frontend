/**
 * The chat page draws no chat: it publishes the node the docked chat portals its
 * thread into (with the chat's skeleton in it, and the thread held out, until the chat
 * is up and the conversation has loaded), and counts
 * as the one place the open chat is on screen. When the dialog does not exist or fails to load, it shows that
 * instead of the node — so the dock falls back to its composer.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatPageNodeStore } from '@/app/components/mingo-shell/chat-page-node-store';
import { routes } from '@/lib/routes';
import { fakeChatProbe, makeFakeChat, resetFakeChatProbe } from '../providers/__tests__/fake-mingo-chat';
import { MingoChatProvider } from '../providers/mingo-chat-provider';
import { mingoDialogQueryKeys } from '../utils/query-keys';
import { MingoChatView } from './mingo-chat-view';

const replace = vi.hoisted(() => vi.fn<(href: string) => void>());
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlag: () => false }));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({ ChatMessageList: () => null }));
vi.mock('@flamingo-stack/openframe-frontend-core/components', () => ({
  LoadingRegion: ({ children }: { children: ReactNode }) => <div aria-busy="true">{children}</div>,
  UnifiedSkeleton: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({
  ChatExclamationIcon: () => null,
  ChatXmarkIcon: () => null,
  Refresh01RightIcon: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  Button: ({ children, href, onClick }: { children: ReactNode; href?: string; onClick?: () => void }) =>
    href ? (
      <a href={href}>{children}</a>
    ) : (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
  NoData: ({ title, description, button }: { title: string; description: string; button?: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {button}
    </section>
  ),
}));
vi.mock('../hooks/use-mingo-unified-chat-state', async () => ({
  useMingoUnifiedChatState: (await import('../providers/__tests__/fake-mingo-chat')).useFakeMingoUnifiedChatState,
}));
vi.mock('../hooks/use-mingo-realtime-subscription', async () => ({
  DialogSubscription: (await import('../providers/__tests__/fake-mingo-chat')).FakeDialogSubscription,
}));
vi.mock('../hooks/use-mingo-dialog-selection', () => ({ MINGO_DIALOG_NOT_FOUND: 'MINGO_DIALOG_NOT_FOUND' }));
vi.mock('@/app/components/mingo-compaction-watchers', () => ({ MingoCompactionWatchers: () => null }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.openframe.ai' } }));

const selectDialog = vi.fn<(id: string | null) => void>();
let queryClient: QueryClient;
let container: HTMLDivElement;
let root: Root;

function render(page: boolean) {
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <MingoChatProvider enabled identityEnabled={false}>
          {page && <MingoChatView dialogId="d-1" />}
        </MingoChatProvider>
      </QueryClientProvider>,
    ),
  );
}

beforeEach(() => {
  replace.mockReset();
  selectDialog.mockReset();
  useChatPageNodeStore.setState({ node: null, chatMounted: false, threadReady: false });
  queryClient = new QueryClient();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoChatView', () => {
  it('selects its dialog, publishes the thread node and marks the chat on screen while mounted', () => {
    resetFakeChatProbe(makeFakeChat({ activeDialogId: null, selectDialog }));
    render(true);
    expect(selectDialog).toHaveBeenCalledWith('d-1');

    fakeChatProbe.result = makeFakeChat({ activeDialogId: 'd-1', selectDialog });
    render(true);

    const node = useChatPageNodeStore.getState().node;
    expect(node).toBe(container.querySelector('[data-testid="mingo-chat-thread-slot"]'));
    expect(fakeChatProbe.onScreenTails).toEqual(['d-1']);

    render(false);
    expect(useChatPageNodeStore.getState().node).toBeNull();
  });

  it("holds the chat's skeleton, and the thread out, until the dock's chat is up and the conversation has loaded", () => {
    resetFakeChatProbe(makeFakeChat({ activeDialogId: 'd-1', isMessagesLoading: true, selectDialog }));
    render(true);
    const slot = () => container.querySelector('[data-testid="mingo-chat-thread-slot"]');
    const threadReady = () => useChatPageNodeStore.getState().threadReady;
    expect(slot()?.querySelector('[aria-busy="true"]')).not.toBeNull();

    act(() => useChatPageNodeStore.getState().setChatMounted(true));
    expect(slot()?.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(threadReady()).toBe(false);

    fakeChatProbe.result = makeFakeChat({ activeDialogId: 'd-1', selectDialog });
    render(true);
    expect(slot()?.childElementCount).toBe(0);
    expect(threadReady()).toBe(true);

    // Loading again (an older page, a chat picked from here): the thread stays in.
    fakeChatProbe.result = makeFakeChat({ activeDialogId: 'd-1', isMessagesLoading: true, selectDialog });
    render(true);
    expect(slot()?.childElementCount).toBe(0);
    expect(threadReady()).toBe(true);

    render(false);
    expect(threadReady()).toBe(false);
  });

  it('shows a dialog that does not exist as such, with the way home, and no thread', () => {
    resetFakeChatProbe(makeFakeChat({ activeDialogId: 'd-1', dialogError: 'MINGO_DIALOG_NOT_FOUND', selectDialog }));
    render(true);

    expect(container.textContent).toContain('Conversation not available');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(routes.mingo.home);
    expect(useChatPageNodeStore.getState().node).toBeNull();
    expect(fakeChatProbe.onScreenTails).toEqual([]);
  });

  it('offers a retry when the dialog failed to load', () => {
    const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue();
    resetFakeChatProbe(makeFakeChat({ activeDialogId: 'd-1', dialogError: 'Network error', selectDialog }));
    render(true);
    expect(container.textContent).toContain("Couldn't open this conversation");

    act(() => container.querySelector('button')?.click());
    expect(refetch).toHaveBeenCalledWith({ queryKey: mingoDialogQueryKeys.detail('d-1') });
    expect(refetch).toHaveBeenCalledWith({ queryKey: mingoDialogQueryKeys.messages('d-1') });
  });
});
