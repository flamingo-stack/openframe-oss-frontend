/**
 * What OpenFrame's chat can do, as the dock hands it to `EmbeddableChat`: the session's
 * state, the row status glyphs and "What to ask Mingo?", every dialog action (Compact
 * while its flag is on), and quick actions that start their chat through the send the
 * dock passes.
 */

import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeChat } from '@/app/(app)/mingo/providers/__tests__/fake-mingo-chat';
import type { MingoChatState } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { type OpenframeChatProps, useOpenframeChatProps } from './use-openframe-chat-props';

const { whatToAsk } = vi.hoisted(() => ({ whatToAsk: async () => [] }));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  getAgentAccent: () => 'mingo',
  renderQuickActionIcon: () => null,
}));
vi.mock('@/app/(app)/help-center/endpoints', () => ({ KNOWLEDGE_BASE_ROUTE: '/help-center/knowledge-base' }));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-dialogs', () => ({ MINGO_DIALOGS_PAGE_SIZE: 20 }));
vi.mock('@/app/(app)/mingo/context/context-sources', () => ({ useMingoContextEntityTypes: () => [] }));
vi.mock('@/app/(app)/mingo/context/mention-chips/render-mention', () => ({
  renderMingoContextItem: () => null,
  renderMingoMention: () => null,
}));
vi.mock('@/app/(app)/mingo/context/render-context-items', () => ({ renderMingoContextItems: () => null }));
vi.mock('@/app/(app)/mingo/context/use-context-memory', () => ({ useMingoContextMemory: () => undefined }));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-quick-actions', () => ({
  useMingoQuickActions: () => ({
    actions: [{ id: 'qa-1', name: 'Disk cleanup', instructions: 'Free up disk space' }],
    loading: false,
  }),
}));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-what-to-ask', () => ({ useMingoWhatToAsk: () => whatToAsk }));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: (select: (state: { user: { firstName: string; lastName: string } }) => unknown) =>
    select({ user: { firstName: 'Ann', lastName: 'Lee' } }),
}));
vi.mock('@/lib/image-url', () => ({ getFullImageUrl: () => undefined }));

const chat = { ...makeFakeChat({ activeDialogId: 'd-1' }) } as unknown as MingoChatState;
const copyDialogLink = vi.fn(async () => {});
const sendInNewDialog = vi.fn(async () => {});
const compactDialog = vi.fn();
const probe = { compact: true };

let container: HTMLDivElement;
let root: Root;
const seen: { props: OpenframeChatProps | null } = { props: null };

function Probe() {
  const props = useOpenframeChatProps({
    chat,
    copyDialogLink,
    compactDialog: probe.compact ? compactDialog : undefined,
    sendInNewDialog,
  });
  useLayoutEffect(() => {
    seen.props = props;
  });
  return null;
}

beforeEach(() => {
  seen.props = null;
  sendInNewDialog.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useOpenframeChatProps', () => {
  it("hands the chat the session's state, row status and What to ask Mingo", () => {
    expect(seen.props).toMatchObject({
      mingoState: chat.state,
      dialogStatusOf: chat.dialogStatusOf,
      whatToAsk,
      pendingApprovals: chat.pendingApprovals,
      modes: {},
      userDisplayName: 'Ann Lee',
    });
  });

  it('offers every dialog action, Compact compacting the chat it is asked for', () => {
    expect(seen.props?.mingoDialogCapabilities).toMatchObject({
      canRename: true,
      canArchive: true,
      unarchiveDialog: chat.unarchiveDialog,
      fetchArchivedDialogs: chat.fetchArchivedDialogs,
      onCopyLink: copyDialogLink,
    });
    seen.props?.mingoDialogCapabilities?.compactDialog?.({ id: 'd-7', title: 'Disk space' });
    expect(compactDialog).toHaveBeenCalledWith('d-7');
  });

  it('offers no Compact while its flag is off', () => {
    probe.compact = false;
    act(() => root.render(<Probe />));
    expect(seen.props?.mingoDialogCapabilities?.compactDialog).toBeUndefined();
    probe.compact = true;
  });

  it('starts a quick action through the send it is given', () => {
    const [action] = seen.props?.mingoWelcome?.quickActions ?? [];
    expect(action).toMatchObject({ id: 'qa-1', label: 'Disk cleanup', prompt: 'Free up disk space' });

    action?.onClick?.();
    expect(sendInNewDialog).toHaveBeenCalledWith('Free up disk space');
  });
});
