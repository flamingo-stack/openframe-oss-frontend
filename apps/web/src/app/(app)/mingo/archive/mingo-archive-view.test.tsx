/**
 * The archive page lists archived chats only, a page at a time through the drawer's
 * archived-dialog fetcher, and opens a chat on its chat page (read-only there, with
 * Unarchive in its header).
 */

import type { ChatArchivePageProps, DialogItem } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { MingoArchiveView } from './mingo-archive-view';

const { push, seen, fetchArchivedDialogs } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  seen: { archive: null as ChatArchivePageProps | null },
  fetchArchivedDialogs:
    vi.fn<
      (params: { cursor?: string; limit?: number }) => Promise<{ dialogs: DialogItem[]; nextCursor: string | null }>
    >(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@flamingo-stack/openframe-frontend-core', () => ({
  PageLayout: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  ChatArchivePage: (props: ChatArchivePageProps) => {
    seen.archive = props;
    return null;
  },
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/icons-v2', () => ({
  AlertCircleIcon: () => null,
  Refresh01RightIcon: () => null,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  NoData: ({ title, button }: { title: string; button?: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {button}
    </section>
  ),
}));
vi.mock('../hooks/use-mingo-dialog-actions', () => ({ useMingoDialogActions: () => ({ fetchArchivedDialogs }) }));

const FIRST: DialogItem = { id: 'd-1', title: 'Backups', archived: true };
const SECOND: DialogItem = { id: 'd-2', title: 'Printers', archived: true };

let container: HTMLDivElement;
let root: Root;

/** Lets the fetch resolve and React Query's batched notifications (timers) land. */
async function settle() {
  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function render() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <MingoArchiveView />
      </QueryClientProvider>,
    ),
  );
  await settle();
}

function archive(): ChatArchivePageProps {
  if (!seen.archive) throw new Error('the archive list was not rendered');
  return seen.archive;
}

beforeEach(() => {
  vi.clearAllMocks();
  seen.archive = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoArchiveView', () => {
  it('lists the archived chats a page at a time', async () => {
    fetchArchivedDialogs
      .mockResolvedValueOnce({ dialogs: [FIRST], nextCursor: 'c-1' })
      .mockResolvedValueOnce({ dialogs: [SECOND], nextCursor: null });
    await render();

    expect(container.textContent).toContain('Chat Archive');
    expect(fetchArchivedDialogs).toHaveBeenCalledWith({ cursor: undefined, limit: 20 });
    expect(archive()).toMatchObject({ embedded: true, dialogs: [FIRST], hasMore: true, isLoading: false });

    act(() => archive().onLoadMore?.());
    await settle();
    expect(fetchArchivedDialogs).toHaveBeenLastCalledWith({ cursor: 'c-1', limit: 20 });
    expect(archive()).toMatchObject({ dialogs: [FIRST, SECOND], hasMore: false });
  });

  it('opens an archived chat on its chat page', async () => {
    fetchArchivedDialogs.mockResolvedValueOnce({ dialogs: [FIRST], nextCursor: null });
    await render();

    act(() => archive().onSelectDialog('d-1'));
    expect(push).toHaveBeenCalledWith(routes.mingo.chat('d-1'));
  });

  it('says the archive failed to load, and tries again', async () => {
    fetchArchivedDialogs.mockRejectedValueOnce(new Error('down'));
    await render();
    expect(container.textContent).toContain("Couldn't load the archive");

    fetchArchivedDialogs.mockResolvedValueOnce({ dialogs: [FIRST], nextCursor: null });
    act(() => container.querySelector('button')?.click());
    await settle();
    expect(archive().dialogs).toEqual([FIRST]);
  });
});
