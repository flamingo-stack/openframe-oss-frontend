'use client';

/**
 * MingoChatProvider — the Mingo chat state, once per session, for every surface
 * that shows it.
 *
 * A second copy of the state would be a second list poll and a second live tail
 * applying every chunk twice, so the provider owns the one copy; a surface — the
 * composer dock, for the whole session — registers itself (`useMingoChatSurface`)
 * and reads it.
 *
 * ## What runs when
 *
 * - `enabled` (AppShell: signed-in session, unlocked workspace): the compaction
 *   watchers, which send nothing until a compaction is started.
 * - `enabled` and at least one surface registered: the state — the dialog list
 *   (polled), the open dialog and its history, the slash-command catalog, the AI
 *   model, the live tail of the open dialog and the dialog-error toast. It mounts
 *   with the first surface and unmounts with the last, and does not keep its local
 *   state in between (search term, list scope, live model).
 *
 * ## Subscribed is not on screen
 *
 * The live tail also marks the open dialog "on screen" (`active-dialog-views`): its
 * notifications skip the popup and are read on arrival. The dock keeps the tail
 * running on every page but shows the thread only on the chat page, so the dialog
 * is on screen only while that page says so (`useMingoChatThreadOnScreen`);
 * everywhere else its popups show.
 *
 * ## Chat identity
 *
 * `identityEnabled` is AppShell's (never in the native shells), carried here for
 * surfaces to hand to their own
 * `<ChatIdentityProvider>`. The provider does not mount one itself: it wraps the
 * page as well, and a `ChatIdentityProvider` there would answer the Help Center's
 * `useChatIdentity()` with its deferred (anon) identity instead of letting it fetch.
 */

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { MingoCompactionWatchers } from '@/app/components/mingo-compaction-watchers';
import { useFeatureFlag } from '@/app/hooks/use-feature-flag';
import { mingoDialogLink } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { useMingoCompactionStore } from '../stores/mingo-compaction-store';
import { MingoChatRunner, MingoChatRunnerBoundary } from './mingo-chat-runner';
import {
  createMingoChatStore,
  IDLE_MINGO_CHAT,
  type MingoChatSnapshot,
  type MingoChatState,
  type MingoChatStore,
} from './mingo-chat-store';

export type { MingoChatState } from './mingo-chat-store';

/** What `useMingoChat()` hands a surface. */
export interface MingoChat {
  /**
   * The session's chat state, or null while it is not running — no surface
   * registered yet (the first pass of the first one), the provider disabled, or
   * the state failed. A surface renders nothing for null: the state lands before
   * the browser paints.
   */
  chat: MingoChatState | null;
  /** The state crashed. A surface rethrows it into its own error boundary. */
  error: Error | null;
  /** Signed-in session and unlocked workspace. False: nothing runs. */
  enabled: boolean;
  /** Whether a surface's `<ChatIdentityProvider>` may resolve the identity. */
  identityEnabled: boolean;
  /**
   * "Compact chat memory" for a dialog; undefined while the `mingo-compact-memory`
   * flag is off. The result is reported by the compaction watchers (toasts), not
   * by the caller.
   */
  compactDialog: ((dialogId: string) => void) | undefined;
  /** Puts the dialog's canonical link on the clipboard, with toast feedback. */
  copyDialogLink: (dialog: { id: string }) => Promise<void>;
  /** Starts the state again after it crashed (`error`): a surface's "Try again". */
  retry: () => void;
}

interface MingoChatSession {
  store: MingoChatStore;
  /** Counts a surface in; the returned function counts it out. */
  register: () => () => void;
  /** Counts a view of the open thread in (Mingo-first chat page); the returned function counts it out. */
  registerThreadView: () => () => void;
  enabled: boolean;
  identityEnabled: boolean;
  compactDialog: MingoChat['compactDialog'];
  copyDialogLink: MingoChat['copyDialogLink'];
  retry: MingoChat['retry'];
}

const MingoChatSessionContext = createContext<MingoChatSession | null>(null);

interface MingoChatProviderProps {
  /** Run nothing until true: AppShell passes a signed-in session on an unlocked workspace. */
  enabled: boolean;
  /** AppShell's chat-identity latch, handed to the surfaces. */
  identityEnabled: boolean;
  children: ReactNode;
}

/**
 * Mount ONCE, unconditionally (gate it through `enabled`), around everything a
 * surface can live in — the layout, the dock and the page. Its children
 * keep their tree position whether the state runs or not; only the state itself
 * mounts and unmounts beside them.
 */
export function MingoChatProvider({ enabled, identityEnabled, children }: MingoChatProviderProps) {
  const [store] = useState(createMingoChatStore);
  const [surfaceCount, setSurfaceCount] = useState(0);
  // Stable on purpose, not for speed: it is the registration effect's dependency,
  // and a new function each render would count every surface out and back in.
  const register = useCallback(() => {
    setSurfaceCount(count => count + 1);
    return () => setSurfaceCount(count => count - 1);
  }, []);
  const [threadViewCount, setThreadViewCount] = useState(0);
  const registerThreadView = useCallback(() => {
    setThreadViewCount(count => count + 1);
    return () => setThreadViewCount(count => count - 1);
  }, []);
  // See "Subscribed is not on screen".
  const onScreen = threadViewCount > 0;
  // A new key remounts the runner: the crashed one unmounts and resets the store, and
  // the next starts a fresh state. Without it a crash lasts while any surface is up.
  const [runKey, setRunKey] = useState(0);
  const retry = useCallback(() => setRunKey(key => key + 1), []);

  const { toast } = useToast();

  const compactMemoryEnabled = useFeatureFlag('mingo-compact-memory');
  const startCompaction = useMingoCompactionStore(s => s.startCompaction);
  const compactDialog = compactMemoryEnabled
    ? (dialogId: string) => {
        // The result is reported by `MingoCompactionWatchers` when the compaction ends.
        if (!startCompaction(dialogId)) toast({ title: 'Already compacting this chat' });
      }
    : undefined;

  // "Copy chat link" — the header ⋯ menu and every dialog row menu.
  //
  // Emits `mingoDialogLink`, NOT the URL in the address bar: the live URL is
  // `?mingoDialog=` riding whatever page the sharer happens to be on, so copying that
  // would hand the recipient the sharer's current screen. Absolute, because a link
  // gets pasted somewhere this app isn't.
  //
  // The origin is the TENANT HOST, not `window.location.origin`: inside the native
  // shells the latter is `capacitor://localhost` (mobile) or a `tauri://` origin —
  // a scheme nothing outside that install can resolve, so the link would be dead the
  // moment it left the device, including for the person who copied it. The tenant
  // host is the workspace's public address (build-time value, backed by the host the
  // shell learns from the OAuth callback at login) and on the web it resolves to the
  // same place anyway. Same precedence the Relay environment uses.
  const copyDialogLink = async (dialog: { id: string }) => {
    const origin = (runtimeEnv.tenantHostUrl() || window.location.origin).replace(/\/+$/, '');
    // Catches BOTH "no tenant host configured" and a shell origin that slipped
    // through — a link that isn't http(s) cannot travel, so say so rather than put
    // something unusable on the clipboard.
    if (!/^https?:\/\//.test(origin)) {
      toast({
        title: "Couldn't copy the link",
        description: 'This app does not know its workspace address yet.',
        variant: 'destructive',
      });
      return;
    }
    const url = `${origin}${mingoDialogLink(dialog.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Anyone with access to this workspace can open it.' });
    } catch {
      // Clipboard access is refused outside a secure context and under some
      // permission policies. Showing the URL is a worse-but-real fallback — the
      // reader can still select it by hand.
      toast({ title: "Couldn't copy the link", description: url, variant: 'destructive' });
    }
  };

  const session: MingoChatSession = {
    store,
    register,
    registerThreadView,
    enabled,
    identityEnabled,
    compactDialog,
    copyDialogLink,
    retry,
  };
  const running = enabled && surfaceCount > 0;

  return (
    <MingoChatSessionContext.Provider value={session}>
      {running ? (
        <MingoChatRunnerBoundary key={runKey} store={store}>
          {/* Nothing in the state suspends today. If something ever does, it must
              not reach the shell's own boundary, which would blank the whole app. */}
          <Suspense fallback={null}>
            <MingoChatRunner store={store} onScreen={onScreen} />
          </Suspense>
        </MingoChatRunnerBoundary>
      ) : null}
      {/* Outlive every surface: a compaction started from the panel still reports
          its result after the panel closes. */}
      {enabled ? <MingoCompactionWatchers /> : null}
      {children}
    </MingoChatSessionContext.Provider>
  );
}

const subscribeToNothing = () => () => {};
const getIdleSnapshot = (): MingoChatSnapshot => IDLE_MINGO_CHAT;

/**
 * The session's chat state, WITHOUT asking for it to run — for a reader that sits
 * beside a surface. To make it run, a surface calls `useMingoChatSurface()`.
 */
export function useMingoChat(): MingoChat {
  const session = useContext(MingoChatSessionContext);
  const { chat, error } = useSyncExternalStore(
    session?.store.subscribe ?? subscribeToNothing,
    session?.store.getSnapshot ?? getIdleSnapshot,
    getIdleSnapshot,
  );
  if (!session) {
    throw new Error(
      'useMingoChat() was called outside <MingoChatProvider>. AppShell (components/app-layout.tsx) mounts the ' +
        'provider once around the whole layout; a chat surface rendered anywhere else has no chat state to read.',
    );
  }
  return {
    chat,
    error,
    enabled: session.enabled,
    identityEnabled: session.identityEnabled,
    compactDialog: session.compactDialog,
    copyDialogLink: session.copyDialogLink,
    retry: session.retry,
  };
}

/**
 * `useMingoChat()` for a component that SHOWS the chat: counts it in while it is
 * mounted, and the state runs while any surface is counted in (see "What runs
 * when" above). Registered in a layout effect, so the state starts in the same pass
 * and is on screen before the browser paints.
 */
export function useMingoChatSurface(): MingoChat {
  const register = useContext(MingoChatSessionContext)?.register;
  useLayoutEffect(() => register?.(), [register]);
  return useMingoChat();
}

/**
 * Says the open dialog's thread is on screen while the caller is mounted — the chat
 * page, the one place the thread shows. Its notifications then skip the popup and
 * are read on arrival.
 */
export function useMingoChatThreadOnScreen(): void {
  const registerThreadView = useContext(MingoChatSessionContext)?.registerThreadView;
  useLayoutEffect(() => registerThreadView?.(), [registerThreadView]);
}
