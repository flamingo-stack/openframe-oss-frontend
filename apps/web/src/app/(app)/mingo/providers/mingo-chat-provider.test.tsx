/**
 * Pins the session contract of `MingoChatProvider`: one chat state however many
 * surfaces read it, running only while a surface is registered (that is what keeps
 * the classic drawer's network traffic where it was), and the per-session effects —
 * launcher prompt, dialog-error toast, compaction — happening once.
 */

import { act, Component, type ReactNode, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatDrawerErrorBoundary } from '@/app/components/chat-drawer-error-boundary';
import { mingoDialogLink } from '@/lib/routes';
import { useMingoCompactionStore } from '../stores/mingo-compaction-store';
import { useMingoLauncherStore } from '../stores/mingo-launcher-store';
import { fakeChatProbe, makeFakeChat, resetFakeChatProbe } from './__tests__/fake-mingo-chat';
import { type MingoChat, MingoChatProvider, useMingoChat, useMingoChatSurface } from './mingo-chat-provider';

const { toast, flags, watchers } = vi.hoisted(() => ({
  toast: vi.fn(),
  flags: new Map<string, boolean>(),
  watchers: { mounted: 0 },
}));

vi.mock('../hooks/use-mingo-unified-chat-state', async () => ({
  useMingoUnifiedChatState: (await import('./__tests__/fake-mingo-chat')).useFakeMingoUnifiedChatState,
}));
vi.mock('../hooks/use-mingo-realtime-subscription', async () => ({
  DialogSubscription: (await import('./__tests__/fake-mingo-chat')).FakeDialogSubscription,
}));
vi.mock('../hooks/use-mingo-dialog-selection', () => ({ MINGO_DIALOG_NOT_FOUND: 'MINGO_DIALOG_NOT_FOUND' }));
vi.mock('@/app/components/mingo-compaction-watchers', async () => {
  const { useEffect } = await import('react');
  return {
    MingoCompactionWatchers: () => {
      useEffect(() => {
        watchers.mounted += 1;
        return () => {
          watchers.mounted -= 1;
        };
      }, []);
      return null;
    },
  };
});
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast, dismiss: vi.fn() }) }));
vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlag: (name: string) => flags.get(name) ?? false }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.openframe.ai' } }));

/** What each probe last read, by name. */
const seen = new Map<string, MingoChat>();

function Surface({ name }: { name: string }) {
  const chat = useMingoChatSurface();
  useLayoutEffect(() => {
    seen.set(name, chat);
  });
  return null;
}

function Reader({ name }: { name: string }) {
  const chat = useMingoChat();
  useLayoutEffect(() => {
    seen.set(name, chat);
  });
  return null;
}

/** A surface the way the chat panel is one: the state's crash goes to its own boundary. */
function CrashingSurface() {
  const { error } = useMingoChatSurface();
  if (error) throw error;
  return <p>chat</p>;
}

class CaptureError extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  render() {
    return this.state.message ? <p>{this.state.message}</p> : this.props.children;
  }
}

let container: HTMLDivElement;
let root: Root;

function render(node: ReactNode) {
  act(() => {
    root.render(node);
  });
}

function shell(surfaces: string[], { enabled = true }: { enabled?: boolean } = {}) {
  return (
    <MingoChatProvider enabled={enabled} identityEnabled={false}>
      <Reader name="reader" />
      {surfaces.map(name => (
        <Surface key={name} name={name} />
      ))}
    </MingoChatProvider>
  );
}

describe('MingoChatProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.clear();
    seen.clear();
    watchers.mounted = 0;
    resetFakeChatProbe(makeFakeChat({ activeDialogId: 'd-1' }));
    useMingoLauncherStore.setState({ pendingPrompt: null, pendingDraft: null, pendingNewChat: false });
    useMingoCompactionStore.setState({ compactingDialogIds: [] });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('runs nothing until a surface registers', () => {
    render(shell([]));

    expect(fakeChatProbe.created).toBe(0);
    expect(fakeChatProbe.liveTails).toEqual([]);
    expect(seen.get('reader')?.chat).toBeNull();
    // The compaction watchers do not wait for a surface: they outlive the panel.
    expect(watchers.mounted).toBe(1);
  });

  it('runs one chat state for two surfaces, and both read it', () => {
    render(shell(['drawer', 'dock']));

    expect(fakeChatProbe.created).toBe(1);
    expect(fakeChatProbe.mounted).toBe(1);
    expect(fakeChatProbe.liveTails).toEqual(['d-1']);
    const state = fakeChatProbe.result?.state;
    expect(seen.get('drawer')?.chat?.state).toBe(state);
    expect(seen.get('dock')?.chat?.state).toBe(state);
    // A reader beside them sees the same state without registering.
    expect(seen.get('reader')?.chat?.state).toBe(state);
    // The live tail is the provider's alone.
    expect(seen.get('drawer')?.chat).not.toHaveProperty('subscription');
  });

  it('starts with the first surface and stops with the last', () => {
    render(shell(['drawer']));
    expect(fakeChatProbe.mounted).toBe(1);
    expect(fakeChatProbe.liveTails).toEqual(['d-1']);

    render(shell([]));
    expect(fakeChatProbe.mounted).toBe(0);
    expect(fakeChatProbe.liveTails).toEqual([]);
    expect(seen.get('reader')?.chat).toBeNull();

    // A new open is a fresh state, as a remounted drawer was: nothing local carries over.
    render(shell(['drawer']));
    expect(fakeChatProbe.created).toBe(2);
    expect(fakeChatProbe.mounted).toBe(1);
    expect(fakeChatProbe.liveTails).toEqual(['d-1']);
  });

  it('keeps running while any surface is left', () => {
    render(shell(['drawer', 'dock']));
    render(shell(['dock']));

    expect(fakeChatProbe.created).toBe(1);
    expect(fakeChatProbe.mounted).toBe(1);
    expect(seen.get('dock')?.chat).not.toBeNull();
  });

  it('runs nothing while disabled, not even the compaction watchers', () => {
    render(shell(['drawer'], { enabled: false }));

    expect(fakeChatProbe.created).toBe(0);
    expect(watchers.mounted).toBe(0);
    expect(seen.get('drawer')).toMatchObject({ chat: null, enabled: false });
  });

  it('refuses to be read outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <CaptureError>
        <Reader name="orphan" />
      </CaptureError>,
    );

    expect(container.textContent).toContain('useMingoChat() was called outside <MingoChatProvider>');
  });

  it("sends a crash in the state to the surface's boundary, not the shell's", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeChatProbe.crash = new Error('boom');
    render(
      <MingoChatProvider enabled identityEnabled={false}>
        <p>page</p>
        <ChatDrawerErrorBoundary>
          <CrashingSurface />
        </ChatDrawerErrorBoundary>
        <Reader name="reader" />
      </MingoChatProvider>,
    );

    expect(container.textContent).toContain('page');
    expect(container.textContent).toContain('Mingo is unavailable right now');
    // The failed surface left, so nothing is registered: closing the panel is the retry.
    expect(seen.get('reader')).toMatchObject({ chat: null, error: null });
  });

  it('sends a queued launcher prompt once, into a new dialog', () => {
    const sendInNewDialog = vi.fn(async () => {});
    resetFakeChatProbe(makeFakeChat({ sendInNewDialog }));
    act(() => {
      useMingoLauncherStore.getState().sendToMingo('Check the backups');
    });

    render(shell(['drawer', 'dock']));

    expect(sendInNewDialog).toHaveBeenCalledTimes(1);
    expect(sendInNewDialog).toHaveBeenCalledWith('Check the backups');
    expect(useMingoLauncherStore.getState().pendingPrompt).toBeNull();
  });

  it('toasts a dialog that does not exist once, and drops the selection', () => {
    const selectDialog = vi.fn();
    resetFakeChatProbe(makeFakeChat({ activeDialogId: 'd-gone', dialogError: 'MINGO_DIALOG_NOT_FOUND', selectDialog }));

    render(shell(['drawer', 'dock']));

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Conversation not available' }));
    expect(selectDialog).toHaveBeenCalledWith(null);
  });

  it('offers compaction behind its flag, and says when one is already running', () => {
    render(shell(['drawer']));
    expect(seen.get('drawer')?.compactDialog).toBeUndefined();

    flags.set('mingo-compact-memory', true);
    render(shell(['drawer']));
    const compactDialog = seen.get('drawer')?.compactDialog;
    act(() => compactDialog?.('d-1'));
    act(() => compactDialog?.('d-1'));

    expect(useMingoCompactionStore.getState().compactingDialogIds).toEqual(['d-1']);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({ title: 'Already compacting this chat' });
  });

  it('copies the canonical link on the tenant host', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(shell([]));

    await act(async () => {
      await seen.get('reader')?.copyDialogLink({ id: 'd-1' });
    });

    expect(writeText).toHaveBeenCalledWith(`https://acme.openframe.ai${mingoDialogLink('d-1')}`);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link copied' }));
    vi.unstubAllGlobals();
  });
});
