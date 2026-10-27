/**
 * The sidebar's chat history is the lib's section over the session's chat state:
 * a row opens its chat page, ⋯ "Chat archive" the archive page, and the row menu runs
 * the same rename / copy-link / archive (with its confirm) as the chat's own menus —
 * without Compact. The search is the shell's one modal, opened from its store (⌘K), and
 * in the 56px rail from the "Chats" row that stands in for the section.
 */

import type { DialogItem, MingoChatRailProps } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeChat } from '@/app/(app)/mingo/providers/__tests__/fake-mingo-chat';
import type { MingoChat, MingoChatState } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { routes } from '@/lib/routes';
import { useHistorySearchStore } from './history-search-store';
import { MingoHistorySearch, MingoSidebarHistory, MingoSidebarHistorySlot } from './mingo-sidebar-history';
import { useMobileMenuStore } from './mobile-menu-store';

const { push, seen, onboarding } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  seen: {
    rail: null as MingoChatRailProps | null,
    rename: null as { isOpen: boolean; initialName?: string; onSave: (name: string) => void } | null,
    archive: null as { isOpen: boolean; onConfirm: () => void } | null,
    mingo: null as MingoChat | null,
    search: null as Record<string, unknown> | null,
    reset: null as { open: boolean; onOpenChange: (open: boolean) => void; onReset?: () => void } | null,
  },
  onboarding: { canReset: true, v2: 'on' as 'loading' | 'on' | 'off' },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  MingoChatRail: (props: MingoChatRailProps) => {
    seen.rail = props;
    return null;
  },
  RenameChatModal: (props: NonNullable<typeof seen.rename>) => {
    seen.rename = props;
    return null;
  },
  ArchiveChatModal: (props: NonNullable<typeof seen.archive>) => {
    seen.archive = props;
    return null;
  },
  MingoChatSearchModal: (props: Record<string, unknown>) => {
    seen.search = props;
    return null;
  },
}));
vi.mock('@/app/(app)/mingo/providers/mingo-chat-provider', () => ({ useMingoChat: () => seen.mingo }));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlagGate: () => onboarding.v2 }));
vi.mock('../reset-onboarding-dialog', () => ({
  useCanResetOnboarding: () => onboarding.canReset,
  ResetOnboardingDialog: (props: NonNullable<typeof seen.reset>) => {
    seen.reset = props;
    return null;
  },
}));

const DIALOG: DialogItem = { id: 'd-1', title: 'Backups' };
const OTHER: DialogItem = { id: 'd-2', title: 'Printers' };

const spies = {
  renameDialog: vi.fn(async (_id: string, _title: string) => {}),
  archiveDialog: vi.fn(async (_id: string) => {}),
  clearMessages: vi.fn(),
  loadMoreDialogs: vi.fn(async () => {}),
  reloadDialogs: vi.fn(),
  setDialogScope: vi.fn(),
  setSearchQuery: vi.fn(),
  copyDialogLink: vi.fn(async (_dialog: { id: string }) => {}),
};

function session(state: Partial<MingoChatState['state']> = {}, extra: Partial<MingoChatState> = {}): MingoChat {
  const base = makeFakeChat({ activeDialogId: 'd-1' });
  return {
    chat: {
      ...base,
      ...extra,
      setSearchQuery: spies.setSearchQuery,
      state: {
        ...base.state,
        dialogs: [DIALOG, OTHER],
        isDialogsLoading: false,
        hasMoreDialogs: true,
        dialogScope: 'my',
        renameDialog: spies.renameDialog,
        archiveDialog: spies.archiveDialog,
        clearMessages: spies.clearMessages,
        loadMoreDialogs: spies.loadMoreDialogs,
        reloadDialogs: spies.reloadDialogs,
        setDialogScope: spies.setDialogScope,
        ...state,
      },
    },
    error: null,
    enabled: true,
    identityEnabled: false,
    compactDialog: vi.fn(),
    copyDialogLink: spies.copyDialogLink,
    retry: vi.fn(),
  };
}

let container: HTMLDivElement;
let root: Root;

function render(mingo: MingoChat) {
  seen.mingo = mingo;
  act(() => root.render(<MingoSidebarHistory />));
}

function rail(): MingoChatRailProps {
  if (!seen.rail) throw new Error('the section was not rendered');
  return seen.rail;
}

beforeEach(() => {
  vi.clearAllMocks();
  seen.rail = null;
  seen.rename = null;
  seen.archive = null;
  seen.search = null;
  seen.reset = null;
  onboarding.canReset = true;
  onboarding.v2 = 'on';
  useHistorySearchStore.setState({ open: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MingoSidebarHistory', () => {
  it('is the section variant over the session list, the selected dialog active', () => {
    render(session());

    expect(rail()).toMatchObject({
      variant: 'section',
      dialogs: [DIALOG, OTHER],
      activeDialogId: 'd-1',
      scope: 'my',
      hasMore: true,
      isLoadingHistory: false,
      isLoadingMore: false,
      loadError: false,
    });
    // Compact lives in the composer, not in the row menu.
    expect(rail().onRequestCompact).toBeUndefined();
  });

  it('opens a chat on its page, and the archive on the archive page', () => {
    render(session());

    act(() => rail().onSelectDialog?.('d-2'));
    expect(push).toHaveBeenLastCalledWith(routes.mingo.chat('d-2'));

    act(() => rail().onOpenArchive?.());
    expect(push).toHaveBeenLastCalledWith(routes.mingo.archive);
  });

  it('offers Reset Onboarding in the history ⋯, confirmed, then takes the user to the wizard', () => {
    render(session());
    const items = rail().moreMenuItems ?? [];
    expect(items.map(item => item.label)).toEqual(['Reset Onboarding']);
    expect(seen.reset?.open).toBe(false);

    act(() => items[0].onClick?.());
    expect(seen.reset?.open).toBe(true);

    act(() => seen.reset?.onReset?.());
    expect(push).toHaveBeenLastCalledWith(routes.setup);
  });

  it('offers no Reset Onboarding without a tour to replay, or without onboarding v2', () => {
    onboarding.canReset = false;
    render(session());
    expect(rail().moreMenuItems).toBeUndefined();

    onboarding.canReset = true;
    onboarding.v2 = 'loading';
    render(session());
    expect(rail().moreMenuItems).toBeUndefined();
  });

  it("tells someone else's chats by the rows' owner ids against the viewer's", () => {
    useAuthStore.setState({ user: { id: 'u-1', email: 'ann@example.com' } });
    render(session());
    expect(rail().currentUserId).toBe('u-1');
    expect(rail().ownedByOther).toBeUndefined();
  });

  it('closes the phone drawer it sits in, also for the chat already open (no location change closes it)', () => {
    render(session());
    useMobileMenuStore.setState({ open: true });

    act(() => rail().onSelectDialog?.('d-1'));
    expect(useMobileMenuStore.getState().open).toBe(false);
    expect(push).toHaveBeenLastCalledWith(routes.mingo.chat('d-1'));
  });

  it('passes scope, search and paging through to the session', () => {
    render(session());

    act(() => rail().onScopeChange?.('all'));
    expect(spies.setDialogScope).toHaveBeenCalledWith('all');
    act(() => rail().onSearchChange?.('printer'));
    expect(spies.setSearchQuery).toHaveBeenCalledWith('printer');
    act(() => rail().onLoadMore?.());
    expect(spies.loadMoreDialogs).toHaveBeenCalledTimes(1);
  });

  it('marks a loading page as the next one when rows are already listed', () => {
    render(session({ isDialogsLoading: true }));
    expect(rail()).toMatchObject({ isLoadingMore: true, isLoadingHistory: false });

    render(session({ isDialogsLoading: true, dialogs: [] }));
    expect(rail()).toMatchObject({ isLoadingMore: false, isLoadingHistory: true });
  });

  it('says the list failed only with nothing to show, and retries through the session', () => {
    render(session({ dialogs: [] }, { dialogsLoadFailed: true }));
    expect(rail().loadError).toBe(true);

    act(() => rail().onRetry?.());
    expect(spies.reloadDialogs).toHaveBeenCalledTimes(1);
  });

  it('binds the search field to the shell (⌘K opens it)', () => {
    render(session());
    expect(rail().searchOpen).toBe(false);

    act(() => useHistorySearchStore.getState().setOpen(true));
    expect(rail().searchOpen).toBe(true);

    act(() => rail().onSearchOpenChange?.(false));
    expect(useHistorySearchStore.getState().open).toBe(false);
  });

  it('copies a chat link through the session', () => {
    render(session());
    act(() => rail().onRequestCopyLink?.(OTHER));
    expect(spies.copyDialogLink).toHaveBeenCalledWith(OTHER);
  });

  it('renames through the Rename modal', () => {
    render(session());
    act(() => rail().onRequestRename?.(OTHER));
    expect(seen.rename).toMatchObject({ isOpen: true, initialName: 'Printers' });

    act(() => seen.rename?.onSave('Office printers'));
    expect(spies.renameDialog).toHaveBeenCalledWith('d-2', 'Office printers');
    expect(seen.rename?.isOpen).toBe(false);
  });

  it('archives after the confirm, and drops the open chat it archived', async () => {
    render(session());
    act(() => rail().onRequestArchive?.(DIALOG));
    expect(seen.archive?.isOpen).toBe(true);
    expect(spies.archiveDialog).not.toHaveBeenCalled();

    await act(async () => seen.archive?.onConfirm());
    expect(spies.archiveDialog).toHaveBeenCalledWith('d-1');
    expect(spies.clearMessages).toHaveBeenCalledTimes(1);
    expect(seen.archive?.isOpen).toBe(false);
  });

  it('keeps another open chat, and keeps the modal open when archiving fails', async () => {
    render(session());
    act(() => rail().onRequestArchive?.(OTHER));
    await act(async () => seen.archive?.onConfirm());
    expect(spies.clearMessages).not.toHaveBeenCalled();

    spies.archiveDialog.mockRejectedValueOnce(new Error('nope'));
    act(() => rail().onRequestArchive?.(DIALOG));
    await act(async () => seen.archive?.onConfirm());
    expect(spies.clearMessages).not.toHaveBeenCalled();
    expect(seen.archive?.isOpen).toBe(true);
  });

  it('shows the loading section until the session state runs, and nothing while chat is off', () => {
    render({ ...session(), chat: null });
    expect(rail()).toMatchObject({ dialogs: [], isLoadingHistory: true, loadError: false });

    seen.rail = null;
    render({ ...session(), chat: null, enabled: false });
    expect(seen.rail).toBeNull();
  });
});

describe('MingoHistorySearch', () => {
  function renderSearch(mingo: MingoChat) {
    seen.mingo = mingo;
    act(() => root.render(<MingoHistorySearch />));
  }

  it('is the search modal over the session list, opened by the shell store', () => {
    renderSearch(session());
    expect(seen.search).toMatchObject({ open: false, dialogs: [DIALOG, OTHER], activeDialogId: 'd-1' });

    act(() => useHistorySearchStore.setState({ open: true }));
    expect(seen.search).toMatchObject({ open: true });
    act(() => (seen.search?.onOpenChange as (open: boolean) => void)(false));
    expect(useHistorySearchStore.getState().open).toBe(false);
  });

  it('opens a picked chat on its page and searches through the session', () => {
    renderSearch(session());
    act(() => (seen.search?.onSelectDialog as (id: string) => void)('d-2'));
    expect(push).toHaveBeenCalledWith(routes.mingo.chat('d-2'));
    (seen.search?.onSearchChange as (term: string) => void)('vpn');
    expect(spies.setSearchQuery).toHaveBeenCalledWith('vpn');
  });

  it('draws nothing while chat is off', () => {
    renderSearch({ ...session(), chat: null, enabled: false });
    expect(seen.search).toBeNull();
  });
});

describe('MingoSidebarHistorySlot', () => {
  it('stands a Chats row in for the section in the rail, which opens the chat search', () => {
    seen.mingo = session();
    act(() => root.render(<MingoSidebarHistorySlot minimized />));

    const chats = container.querySelector<HTMLButtonElement>('button[aria-label="Chats"]');
    expect(chats?.title).toBe('Chats');
    // The section stays mounted beside it: the width decides which one shows.
    expect(seen.rail).not.toBeNull();

    act(() => chats?.click());
    expect(useHistorySearchStore.getState().open).toBe(true);
  });
});
