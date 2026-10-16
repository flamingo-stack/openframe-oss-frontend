'use client';

/**
 * OpenframeEmbeddableChatEntry — the EmbeddableChat surface for
 * openframe-frontend. Hosted inside AppLayout's in-layout drawer
 * (`AppLayoutDrawer`) rather than as a body-level overlay, so the header
 * and sidebar stay visible and interactive while the chat is open. The
 * drawer owns the shell; this component runs the chat shell-less
 * (`shell="none"`) and is open/close-controlled by the host via the
 * `open` / `onOpenChange` props it shares with the drawer.
 *
 * Mingo-mode state is NOT owned by the lib's built-in NATS adapter, and not by
 * this component either: `MingoChatProvider` (mounted once in `AppShell`) runs
 * the session's one `useMingoUnifiedChatState()` and its realtime tail
 * (`<DialogSubscription>`), and this panel registers itself as a surface and
 * reads it (`useMingoChatSurface`), injecting it via `mingoState`. The state
 * runs while a surface is registered — for the classic shell, while this panel
 * is mounted, exactly the lifetime it had when it lived here. Because the data
 * underneath lives in the store + query cache, the drawer can unmount on close
 * and rehydrate instantly on reopen — no `keepMounted`, no refetch, and
 * realtime catches up via JetStream replay on resubscribe.
 *
 * Mingo is the ONLY transport: Guide mode (the SSE hub integration) is NOT
 * wired here, so there is no in-panel mode toggle and no `modes.guide`.
 * Its endpoints still exist on `OpenframeChatRuntimeProvider` (the
 * `/content/`-prefixed paths the reverse proxy forwards to the MPH origin)
 * and are used by the Help Center doc surfaces — re-enabling Guide in this
 * panel would be a one-line `modes` change, not new plumbing.
 *
 * What the chat can do — every prop that is not about where it sits — is built
 * by `useOpenframeChatProps` below, shared with the Mingo-first shell's composer
 * dock (`mingo-shell/mingo-composer-dock.tsx`), so the two shells offer the same
 * chat.
 */

import type {
  ChatContextPickerConfig,
  EmbeddableChatHandle,
  EmbeddableChatProps,
  MingoQuickAction,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  EmbeddableChat,
  getAgentAccent,
  renderQuickActionIcon,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { Refresh01RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useShellVariant } from '@/app/hooks/use-shell-variant';
import { getFullImageUrl } from '@/lib/image-url';
import { KNOWLEDGE_BASE_ROUTE } from '../(app)/help-center/endpoints';
import { useMingoContextEntityTypes } from '../(app)/mingo/context/context-sources';
import { CONTEXT_ITEMS_MAX } from '../(app)/mingo/context/context-types';
import { renderMingoContextItem, renderMingoMention } from '../(app)/mingo/context/mention-chips/render-mention';
import { renderMingoContextItems } from '../(app)/mingo/context/render-context-items';
import { useMingoContextMemory } from '../(app)/mingo/context/use-context-memory';
import { useMingoQuickActions } from '../(app)/mingo/hooks/use-mingo-quick-actions';
import { useMingoWhatToAsk } from '../(app)/mingo/hooks/use-mingo-what-to-ask';
import { type MingoChat, type MingoChatState, useMingoChatSurface } from '../(app)/mingo/providers/mingo-chat-provider';
import { useMingoLauncherStore } from '../(app)/mingo/stores/mingo-launcher-store';
import { useAuthStore } from '../(auth)/auth/stores/auth-store';
import { ResetOnboardingDialog, useCanResetOnboarding } from './reset-onboarding-dialog';

interface OpenframeEmbeddableChatEntryProps {
  /** Controlled open state, shared with the host `AppLayoutDrawer`. */
  open: boolean;
  /** Change handler, shared with the host `AppLayoutDrawer`. The chat's own
   *  in-header X button calls this with `false` to close the drawer. */
  onOpenChange: (open: boolean) => void;
  /** Offer the in-header close button. False when the chat is docked into the
   *  layout and cannot close. Default true. */
  closable?: boolean;
  /** `'inline'` when the host is not a dialog (Mingo docked into the layout);
   *  default `'none'`, inside the `AppLayoutDrawer` dialog. */
  shell?: 'none' | 'inline';
  /** Mingo v2 (the docked panel): the v2 layout, and the →| control that
   *  steps the panel back one size (`collapseTo`, see the lib's EmbeddableChat). */
  v2?: { onCollapse?: () => void; collapseTo?: 'list' | 'column'; onExpand?: () => void };
}

export function OpenframeEmbeddableChatEntry(props: OpenframeEmbeddableChatEntryProps) {
  // Registers this panel as a surface: the session's chat state runs while it is
  // mounted (see `MingoChatProvider`).
  const { chat, error, compactDialog, copyDialogLink } = useMingoChatSurface();
  // The state failed as a whole; this panel's boundary (`ChatDrawerErrorBoundary`)
  // shows it, as it did when the state lived here.
  if (error) throw error;
  // Only the first pass after registering: the provider starts the state and
  // publishes it before the browser paints. The panel mounts with it, so its
  // handle exists by the time the launcher's draft / new-chat requests drain.
  if (!chat) return null;
  return <EmbeddableChatPanel {...props} chat={chat} compactDialog={compactDialog} copyDialogLink={copyDialogLink} />;
}

interface EmbeddableChatPanelProps extends OpenframeEmbeddableChatEntryProps {
  chat: MingoChatState;
  compactDialog: MingoChat['compactDialog'];
  copyDialogLink: MingoChat['copyDialogLink'];
}

function EmbeddableChatPanel({
  open,
  onOpenChange,
  closable = true,
  shell = 'none',
  v2,
  chat,
  compactDialog,
  copyDialogLink,
}: EmbeddableChatPanelProps) {
  const { props: chatProps, overlays } = useOpenframeChatProps({ chat, compactDialog, copyDialogLink, v2: !!v2 });

  // A queued launcher PROMPT (`sendToMingo`) needs no panel, so the session drains
  // it (`MingoChatProvider`'s runner). The two below go through this panel's handle.
  //
  // Queued launcher "start a new chat". Nothing to send and nothing the host can
  // set — which view the narrow panel shows with no open conversation (list vs.
  // composer) is its own state — so this goes to its imperative handle. A
  // one-shot drain: it must fire on a fresh open AND while the drawer is
  // already open on the list.
  const chatHandle = useRef<EmbeddableChatHandle>(null);
  const pendingNewChat = useMingoLauncherStore(s => s.pendingNewChat);
  const consumePendingNewChat = useMingoLauncherStore(s => s.consumePendingNewChat);

  useEffect(() => {
    if (!pendingNewChat) return;
    if (!consumePendingNewChat()) return;
    chatHandle.current?.startNewChat();
  }, [pendingNewChat, consumePendingNewChat]);

  // Queued launcher draft (`draftToMingo` — e.g. "Fix with Mingo" on an incident):
  // a fresh chat with the composer prefilled and nothing sent. The same one-shot
  // drain, through the handle, since the composer's text is the panel's own
  // state.
  const pendingDraft = useMingoLauncherStore(s => s.pendingDraft);
  const consumePendingDraft = useMingoLauncherStore(s => s.consumePendingDraft);

  useEffect(() => {
    if (!pendingDraft) return;
    const draft = consumePendingDraft();
    if (!draft) return;
    chatHandle.current?.prefillDraft(draft);
  }, [pendingDraft, consumePendingDraft]);

  return (
    <>
      {/* The realtime tail for the active dialog is the session's, rendered by
          `MingoChatProvider` beside the layout. */}
      <EmbeddableChat
        ref={chatHandle}
        // Shell-less: the host `AppLayoutDrawer` owns the panel chrome,
        // open/close, and positioning. `open` / `onOpenChange` are the same
        // state the drawer is bound to, so the chat's in-header X button and
        // the drawer close in lockstep.
        shell={shell}
        appearance={v2 ? 'v2' : 'classic'}
        onCollapse={v2?.onCollapse}
        collapseTo={v2?.collapseTo}
        onExpand={v2?.onExpand}
        open={open}
        onOpenChange={onOpenChange}
        closable={closable}
        {...chatProps}
      />

      {overlays}
    </>
  );
}

/**
 * The `EmbeddableChat` props every OpenFrame chat surface shares: the classic
 * drawer / v2 side panel (`OpenframeEmbeddableChatEntry`) and the Mingo-first
 * composer dock. One implementation, so the two shells cannot drift in what the
 * chat can do (context picker, `@`, memory strip, quick actions, identity, the
 * dialog actions). Each surface adds only its own layout props on top.
 */
export type OpenframeChatProps = Pick<
  EmbeddableChatProps,
  | 'baseRoute'
  | 'chatMenuExtraItems'
  | 'contextMemory'
  | 'contextPicker'
  | 'dialogStatusOf'
  | 'mingoDialogCapabilities'
  | 'mingoState'
  | 'mingoWelcome'
  | 'modes'
  | 'pendingApprovals'
  | 'renderContextItem'
  | 'renderMention'
  | 'userAvatarUrl'
  | 'userDisplayName'
  | 'whatToAsk'
>;

interface OpenframeChatPropsOptions {
  chat: MingoChatState;
  /**
   * "Compact Chat Memory" in the chat's own ⋯ menus (header + rows). Undefined
   * leaves it out: the `mingo-compact-memory` flag is off, or the surface puts it
   * in the composer's ⋯ instead (the dock).
   */
  compactDialog: MingoChat['compactDialog'];
  copyDialogLink: MingoChat['copyDialogLink'];
  /** The Mingo v2 look: row status glyphs, "What to ask Mingo?", Reset Onboarding in the chat ⋯. */
  v2: boolean;
  /** How a quick-action chip starts its chat. Default: the session's `sendInNewDialog`. */
  sendInNewDialog?: (text: string) => Promise<void>;
}

/**
 * Builds {@link OpenframeChatProps} from the session's chat state. `overlays` is
 * what those props open outside the chat (the Reset Onboarding confirmation):
 * render it beside the `EmbeddableChat`.
 */
export function useOpenframeChatProps({
  chat,
  compactDialog,
  copyDialogLink,
  v2,
  sendInNewDialog = chat.sendInNewDialog,
}: OpenframeChatPropsOptions): { props: OpenframeChatProps; overlays: ReactNode } {
  const {
    state,
    pendingApprovals,
    dialogStatusOf,
    searchQuery,
    setSearchQuery,
    fetchArchivedDialogs,
    unarchiveDialog,
  } = chat;

  // v2: "Reset Onboarding" lives in the chat's ⋯ menu (Settings no longer
  // offers it), after the chat's own actions — in the classic shell only: the
  // Mingo-first shell has no onboarding to replay.
  const loadWhatToAsk = useMingoWhatToAsk();
  const hasOnboarding = useCanResetOnboarding();
  const shellVariant = useShellVariant();
  const canResetOnboarding = hasOnboarding && shellVariant === 'classic';
  const [isResetOnboardingOpen, setIsResetOnboardingOpen] = useState(false);
  const chatMenuExtraItems =
    v2 && canResetOnboarding
      ? [
          {
            id: 'reset-onboarding',
            label: 'Reset Onboarding',
            icon: <Refresh01RightIcon className="h-5 w-5 text-ods-text-secondary" />,
            onClick: () => setIsResetOnboardingOpen(true),
          },
        ]
      : undefined;
  // Signed-in user's display name for the chat header sub-line. The lib prefers
  // its server-resolved chat identity; this is the reliable host fallback (the
  // tenant identity route may not return a name) sourced from the auth store.
  const authUser = useAuthStore(s => s.user);
  const userDisplayName = useMemo(() => {
    if (!authUser) return undefined;
    const full = [authUser.firstName, authUser.lastName].filter(Boolean).join(' ').trim();
    return full || authUser.email?.trim() || undefined;
  }, [authUser]);
  // Header-avatar counterpart of the display name (New Chat compose view).
  const userAvatarUrl = getFullImageUrl(authUser?.image?.imageUrl, authUser?.image?.hash);

  // Entity-context picker config (the `+` "Assign Item" menu + `@` trigger).
  // Stable so the lib's composer doesn't re-derive its icon map each render:
  // the hook's list is memoized on the module flags, so the memo moves only
  // when a flag does. `renderMingoContextItems` maps each entity type to its data
  // component (Relay / TanStack hooks); the store-backed openView/recentViews
  // are folded in at send time by the unified hook.
  const entityTypes = useMingoContextEntityTypes();
  const contextPicker = useMemo<ChatContextPickerConfig>(
    () => ({
      entityTypes,
      renderItems: renderMingoContextItems,
      maxItems: CONTEXT_ITEMS_MAX,
    }),
    [entityTypes],
  );

  // Context-memory strip above the composer: the navigation history Mingo
  // carries on every message (current page + previously viewed entities), each
  // droppable from the `⋯` dropdown.
  const contextMemory = useMingoContextMemory();

  // Admin-configured Mingo quick actions (AI Settings → "Mingo AI Chat" tab)
  // become starter chips in the empty state. Clicking one opens a new dialog
  // seeded with the action's instructions — same path the launcher prompt uses.
  const quickActions = useMingoQuickActions();
  const mingoQuickActions = useMemo<MingoQuickAction[]>(
    () =>
      quickActions.map(action => ({
        id: action.id,
        label: action.name,
        variant: 'outline',
        // Product Hub defaults carry a glyph (iconName/iconUrl/iconProps) and
        // tenant customs the `iconName` picked in AI Settings; render it into
        // the chip node. No icon → undefined → a text-only chip. `mingo` accent
        // tints registry glyphs unless the hub icon sets its own color.
        icon: renderQuickActionIcon({
          name: action.iconName ?? undefined,
          url: action.iconUrl ?? undefined,
          props: action.iconProps ?? undefined,
          accent: getAgentAccent('mingo'),
        }),
        // Hover/focus previews the full instruction (what's actually sent) as
        // ghost text in the composer; the chip `label` is just the short name.
        prompt: action.instructions,
        onClick: () => {
          void sendInNewDialog(action.instructions);
        },
      })),
    [quickActions, sendInNewDialog],
  );

  const props: OpenframeChatProps = {
    dialogStatusOf: v2 ? dialogStatusOf : undefined,
    // v2: "What to ask Mingo?" answers in the chat (the open one, else a new
    // one) with prompts that go into the composer, naming online devices.
    whatToAsk: v2 ? loadWhatToAsk : undefined,
    chatMenuExtraItems,
    // Signed-in user's name for the header sub-line under the chat title.
    // Fallback for the lib's server identity when the tenant identity route
    // returns no name — sourced from the host auth store.
    userDisplayName,
    userAvatarUrl,
    // Mingo mode is host-owned via `mingoState`, so we do NOT pass
    // `modes.mingo` — that keeps the lib's built-in NATS adapter idle.
    // The EXPLICIT empty object matters: omitting `modes` entirely makes
    // the lib fall back to its legacy guide-only default, resurrecting the
    // Guide (SSE hub) mode. With no `modes.guide`, the panel is
    // Mingo-only: no mode toggle, no "Start Guide Chat" entry point, and
    // the uncontrolled active mode defaults to 'mingo'.
    modes: {},
    mingoState: state,
    // Where an in-app doc chip navigates. Guide Mode V3 answers cite product
    // documentation, and each cited source renders as a chip whose target is
    // resolved against this route; without it the lib derives one from
    // `runtime.source`, which is the hub's doc tree, not ours.
    baseRoute: KNOWLEDGE_BASE_ROUTE,
    // PENDING approval cards are FILTERED OUT of their bubble by
    // `useMingoDialogChat` (dedupe for interrupted retries), so a card that the
    // reducer built renders nowhere unless it is handed back here — the
    // standalone `/mingo` page has always done this, the drawer never did.
    // That gap hid every pending approval in this panel, including the
    // Product Guide's "create a support ticket" card whose own preamble
    // tells the user to click Approve.
    pendingApprovals,
    // Dialog management for the host-injected Mingo state:
    //  - search: the chat-history search bar emits the debounced term into
    //    `setSearchQuery`, which rides the `useMingoDialogs` query key.
    //  - rename/archive: enable the row + header ⋯ menu (mutations live on
    //    `mingoState` via `useMingoDialogActions`).
    //  - compact: "Compact Chat Memory" in the same menus, flag-gated.
    //  - archive page: `fetchArchivedDialogs` gates the clock-history button;
    //    `unarchiveDialog` enables restore.
    mingoDialogCapabilities: {
      searchQuery,
      onSearchChange: setSearchQuery,
      canRename: true,
      canArchive: true,
      fetchArchivedDialogs,
      unarchiveDialog,
      onCopyLink: copyDialogLink,
      // The result is reported by `MingoCompactionWatchers` when the compaction ends.
      compactDialog: compactDialog ? dialog => compactDialog(dialog.id) : undefined,
    },
    // Admin-configured Mingo quick actions rendered as chips in the Mingo
    // empty state. Omitted when none are configured so the lib keeps its
    // default welcome content.
    mingoWelcome: mingoQuickActions.length > 0 ? { quickActions: mingoQuickActions } : undefined,
    contextPicker,
    // Renders inline AI mentions (`@device:<machineId>` in Mingo's replies)
    // as self-fetching chips — the `@marker:id` analogue of `renderEntityCard`
    // for `[card://]`. Stable module-level fn so the message memo holds.
    renderMention: renderMingoMention,
    // Renders a user's ATTACHED context chips (`contextItems`) as the SAME
    // self-fetching chips as inline mentions — so manually attached context
    // resolves its live name + link instead of the lib's label-only pill.
    renderContextItem: renderMingoContextItem,
    // Context memory (Figma 271:38656): the strip at the top of the composer
    // card naming what Mingo remembers from this session's navigation — the
    // open entity page plus the recently viewed ones — with a `⋯` dropdown
    // to review and forget individual entries. Replaces the old under-the-
    // header page-context banner. The strip self-hides when memory is empty.
    contextMemory,
  };

  const overlays = <ResetOnboardingDialog open={isResetOnboardingOpen} onOpenChange={setIsResetOnboardingOpen} />;

  return { props, overlays };
}
