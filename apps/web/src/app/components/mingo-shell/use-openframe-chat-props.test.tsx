/**
 * What OpenFrame's chat can do, as the dock hands it to `EmbeddableChat`: the row status
 * glyphs and "What to ask Mingo?", and quick actions whose instructions go into the
 * composer. The session's engine and its dialog actions reach the panel through
 * `ChatEngineProvider`, not as props.
 */

import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeChat } from '@/app/(app)/mingo/providers/__tests__/fake-mingo-chat';
import { type OpenframeChatProps, useOpenframeChatProps } from './use-openframe-chat-props';

const { whatToAsk } = vi.hoisted(() => ({ whatToAsk: async () => [] }));

vi.mock('@flamingo-stack/openframe-frontend-core/components/chat', () => ({
  getAgentAccent: () => 'mingo',
  renderQuickActionIcon: () => null,
}));
vi.mock('@/app/(app)/help-center/endpoints', () => ({ KNOWLEDGE_BASE_ROUTE: '/help-center/knowledge-base' }));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-unified-chat-state', () => ({ MINGO_DIALOGS_PAGE_SIZE: 20 }));
vi.mock('@/app/(app)/mingo/context/context-sources', () => ({ useMingoContextEntityTypes: () => [] }));
vi.mock('@/app/(app)/mingo/context/mention-chips/render-mention', () => ({
  renderMingoContextItem: () => null,
  renderMingoRecordChip: () => null,
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

const chat = makeFakeChat({ activeDialogId: 'd-1' });

let container: HTMLDivElement;
let root: Root;
const seen: { props: OpenframeChatProps | null } = { props: null };

function Probe() {
  const props = useOpenframeChatProps({ dialogStatusOf: chat.dialogStatusOf });
  useLayoutEffect(() => {
    seen.props = props;
  });
  return null;
}

beforeEach(() => {
  seen.props = null;
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
  it('hands the chat the row status and What to ask Mingo, and no engine of its own', () => {
    expect(seen.props).toMatchObject({
      dialogStatusOf: chat.dialogStatusOf,
      whatToAsk,
      modes: {},
      userDisplayName: 'Ann Lee',
    });
    expect(seen.props).not.toHaveProperty('mingoState');
    expect(seen.props).not.toHaveProperty('mingoDialogCapabilities');
  });

  it("hands the chat each quick action's instructions, which it puts into its composer", () => {
    const [action] = seen.props?.mingoWelcome?.quickActions ?? [];
    expect(action).toMatchObject({ id: 'qa-1', label: 'Disk cleanup', prompt: 'Free up disk space' });
    // The chat wires the click itself; the chips send nothing of their own.
    expect(action?.onClick).toBeUndefined();
  });
});
