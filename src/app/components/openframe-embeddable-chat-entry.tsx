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
 * Mingo-mode state is NOT owned by the lib's built-in NATS adapter. Instead
 * `useMingoUnifiedChatState()` builds it from the same react-query + Zustand
 * stack the `/mingo` page uses, and we inject it via `mingoState`. Because
 * that state lives OUTSIDE this component (store + query cache), the drawer
 * can unmount on close and rehydrate instantly on reopen — no `keepMounted`,
 * no refetch, and realtime catches up via JetStream replay on resubscribe.
 *
 * Realtime is a rendered component (`<DialogSubscription>`), so we render it
 * here alongside `<EmbeddableChat>`, wired from the hook's `subscription`
 * bundle — exactly as the `/mingo` page does.
 *
 * Mingo is the ONLY transport: Guide mode (the SSE hub integration) is NOT
 * wired here, so there is no in-panel mode toggle and no `modes.guide`.
 * Its endpoints still exist on `OpenframeChatRuntimeProvider` (the
 * `/content/`-prefixed paths the reverse proxy forwards to the MPH origin)
 * and are used by the Help Center doc surfaces — re-enabling Guide in this
 * panel would be a one-line `modes` change, not new plumbing.
 *
 * Coexists with the old `/mingo` page route during migration.
 */

import type {
  ChatContextPickerConfig,
  EmbeddableChatHandle,
  MingoQuickAction,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import {
  EmbeddableChat,
  getAgentAccent,
  renderQuickActionIcon,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import { mingoDialogLink } from '@/lib/routes';
import { runtimeEnv } from '@/lib/runtime-config';
import { KNOWLEDGE_BASE_ROUTE } from '../(app)/help-center/endpoints';
import { MINGO_CONTEXT_ENTITY_TYPES } from '../(app)/mingo/context/context-sources';
import { CONTEXT_ITEMS_MAX } from '../(app)/mingo/context/context-types';
import { renderMingoContextItem, renderMingoMention } from '../(app)/mingo/context/mention-chips/render-mention';
import { renderMingoContextItems } from '../(app)/mingo/context/render-context-items';
import { useMingoContextMemory } from '../(app)/mingo/context/use-context-memory';
import { MINGO_DIALOG_NOT_FOUND } from '../(app)/mingo/hooks/use-mingo-dialog-selection';
import { useMingoQuickActions } from '../(app)/mingo/hooks/use-mingo-quick-actions';
import { DialogSubscription } from '../(app)/mingo/hooks/use-mingo-realtime-subscription';
import { useMingoUnifiedChatState } from '../(app)/mingo/hooks/use-mingo-unified-chat-state';
import { useMingoLauncherStore } from '../(app)/mingo/stores/mingo-launcher-store';
import { useAuthStore } from '../(auth)/auth/stores/auth-store';

interface OpenframeEmbeddableChatEntryProps {
  /** Controlled open state, shared with the host `AppLayoutDrawer`. */
  open: boolean;
  /** Change handler, shared with the host `AppLayoutDrawer`. The chat's own
   *  in-header X button calls this with `false` to close the drawer. */
  onOpenChange: (open: boolean) => void;
}

export function OpenframeEmbeddableChatEntry({ open, onOpenChange }: OpenframeEmbeddableChatEntryProps) {
  const {
    state,
    subscription,
    pendingApprovals,
    sendInNewDialog,
    searchQuery,
    setSearchQuery,
    fetchArchivedDialogs,
    unarchiveDialog,
    dialogError,
  } = useMingoUnifiedChatState();

  // A dialog that won't load is otherwise indistinguishable from an empty one — the
  // panel renders a thread with no messages, which for a conversation reached by link
  // or notification is the whole answer the user gets. Toasted once per
  // (dialog, error) so a retry can't stack duplicates.
  //
  // The reader never sees the underlying error text: it is a raw GraphQL-envelope
  // string, and the two cases a person can act on differently ("this link is dead" vs
  // "the network is") are already separated by `MINGO_DIALOG_NOT_FOUND`.
  const { toast } = useToast();
  const toastedDialogErrorRef = useRef<string | null>(null);
  const activeDialogId = state.activeDialogId;
  const selectDialog = state.selectDialog;
  useEffect(() => {
    if (!dialogError || !activeDialogId) {
      toastedDialogErrorRef.current = null;
      return;
    }
    const key = `${activeDialogId}:${dialogError}`;
    if (toastedDialogErrorRef.current === key) return;
    toastedDialogErrorRef.current = key;

    const missing = dialogError === MINGO_DIALOG_NOT_FOUND;
    toast({
      title: missing ? 'Conversation not available' : "Couldn't open this conversation",
      description: missing
        ? 'It may have been deleted, or you may not have access to it.'
        : 'Check your connection and try again.',
      variant: 'destructive',
    });

    // Only for a settled "not found": drop the selection so the drawer falls back to
    // the chat list and the sync hook strips the dead id from the URL, leaving nothing
    // to re-open on reload or to copy onward. A transient failure keeps its selection,
    // because a reload would have recovered it.
    if (missing) selectDialog(null);
  }, [dialogError, activeDialogId, selectDialog, toast]);

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
  const copyDialogLink = useCallback(
    async (dialog: { id: string }) => {
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
    },
    [toast],
  );

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

  // Queued launcher prompt (`sendToMingo(prompt)` — e.g. the onboarding "Meet
  // Mingo" quick-action chips): drain straight into a fresh Mingo dialog. The
  // drawer unmounts this entry on close and remounts on open, so this runs on
  // every open and re-fires if a new prompt is queued while the drawer is
  // already open. `consumePendingPrompt` nulls the prompt as it reads it, so a
  // header open (no prompt) and StrictMode's double-invoke are both no-ops.
  const pendingPrompt = useMingoLauncherStore(s => s.pendingPrompt);
  const consumePendingPrompt = useMingoLauncherStore(s => s.consumePendingPrompt);

  useEffect(() => {
    if (!pendingPrompt) return;
    const text = consumePendingPrompt();
    if (!text) return;
    void sendInNewDialog(text);
  }, [pendingPrompt, consumePendingPrompt, sendInNewDialog]);

  // Queued launcher "start a new chat". Nothing to send and nothing the host can
  // set — which view the narrow panel shows with no open conversation (list vs.
  // composer) is its own state — so this goes to its imperative handle. Same
  // one-shot drain as the prompt: it must fire on a fresh open AND while the
  // drawer is already open on the list.
  const chatHandle = useRef<EmbeddableChatHandle>(null);
  const pendingNewChat = useMingoLauncherStore(s => s.pendingNewChat);
  const consumePendingNewChat = useMingoLauncherStore(s => s.consumePendingNewChat);

  useEffect(() => {
    if (!pendingNewChat) return;
    if (!consumePendingNewChat()) return;
    chatHandle.current?.startNewChat();
  }, [pendingNewChat, consumePendingNewChat]);

  // Entity-context picker config (the `+` "Assign Item" menu + `@` trigger).
  // Stable so the lib's composer doesn't re-derive its icon map each render.
  // `renderMingoContextItems` maps each entity type to its data component
  // (Relay / TanStack hooks); the store-backed openView/recentViews are folded
  // in at send time by the unified hook.
  const contextPicker = useMemo<ChatContextPickerConfig>(
    () => ({
      entityTypes: MINGO_CONTEXT_ENTITY_TYPES,
      renderItems: renderMingoContextItems,
      maxItems: CONTEXT_ITEMS_MAX,
    }),
    [],
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
        // Product Hub defaults carry a glyph (iconName/iconUrl/iconProps);
        // render it into the chip node. Tenant customs have none → undefined →
        // no icon. `mingo` accent tints registry glyphs unless the hub icon
        // sets its own color. The settings editor deliberately omits this.
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

  return (
    <>
      {/* Realtime tail for the active dialog — writes chunks into the shared
          store, exactly like the /mingo page. Gated on active + subscribed; on
          reopen it resubscribes and replays missed chunks from the stored
          sequence offset. */}
      {subscription.activeDialogId && subscription.isSubscribed && (
        <DialogSubscription
          key={subscription.activeDialogId}
          dialogId={subscription.activeDialogId}
          isActive
          onApprove={subscription.onApprove}
          onReject={subscription.onReject}
          approvalStatuses={subscription.approvalStatuses}
          onConnectionChange={subscription.onConnectionChange}
          onMetadata={subscription.onMetadata}
          initialOptStartSeq={subscription.initialOptStartSeq}
          isInitialOptStartSeqReady={subscription.isInitialOptStartSeqReady}
        />
      )}

      <EmbeddableChat
        ref={chatHandle}
        // Shell-less: the host `AppLayoutDrawer` owns the panel chrome,
        // open/close, and positioning. `open` / `onOpenChange` are the same
        // state the drawer is bound to, so the chat's in-header X button and
        // the drawer close in lockstep.
        shell="none"
        open={open}
        onOpenChange={onOpenChange}
        // Signed-in user's name for the header sub-line under the chat title.
        // Fallback for the lib's server identity when the tenant identity route
        // returns no name — sourced from the host auth store.
        userDisplayName={userDisplayName}
        userAvatarUrl={userAvatarUrl}
        // Mingo mode is host-owned via `mingoState`, so we do NOT pass
        // `modes.mingo` — that keeps the lib's built-in NATS adapter idle.
        // The EXPLICIT empty object matters: omitting `modes` entirely makes
        // the lib fall back to its legacy guide-only default, resurrecting the
        // Guide (SSE hub) mode. With no `modes.guide`, the panel is
        // Mingo-only: no mode toggle, no "Start Guide Chat" entry point, and
        // the uncontrolled active mode defaults to 'mingo'.
        modes={{}}
        mingoState={state}
        baseRoute={KNOWLEDGE_BASE_ROUTE}
        // PENDING approval cards are FILTERED OUT of their bubble by
        // `useMingoChat` (dedupe for interrupted retries), so a card that the
        // reducer built renders nowhere unless it is handed back here — the
        // standalone `/mingo` page has always done this, the drawer never did.
        // That gap hid every pending approval in this panel, including the
        // Product Guide's "create a support ticket" card whose own preamble
        // tells the user to click Approve.
        pendingApprovals={pendingApprovals}
        // Dialog management for the host-injected Mingo state:
        //  - search: the chat-history search bar emits the debounced term into
        //    `setSearchQuery`, which rides the `useMingoDialogs` query key.
        //  - rename/archive: enable the row + header ⋯ menu (mutations live on
        //    `mingoState` via `useMingoDialogActions`).
        //  - archive page: `fetchArchivedDialogs` gates the clock-history button;
        //    `unarchiveDialog` enables restore.
        mingoDialogCapabilities={{
          searchQuery,
          onSearchChange: setSearchQuery,
          canRename: true,
          canArchive: true,
          fetchArchivedDialogs,
          unarchiveDialog,
          onCopyLink: copyDialogLink,
        }}
        // Admin-configured Mingo quick actions rendered as chips in the Mingo
        // empty state. Omitted when none are configured so the lib keeps its
        // default welcome content.
        mingoWelcome={mingoQuickActions.length > 0 ? { quickActions: mingoQuickActions } : undefined}
        contextPicker={contextPicker}
        // Renders inline AI mentions (`@device:<machineId>` in Mingo's replies)
        // as self-fetching chips — the `@marker:id` analogue of `renderEntityCard`
        // for `[card://]`. Stable module-level fn so the message memo holds.
        renderMention={renderMingoMention}
        // Renders a user's ATTACHED context chips (`contextItems`) as the SAME
        // self-fetching chips as inline mentions — so manually attached context
        // resolves its live name + link instead of the lib's label-only pill.
        renderContextItem={renderMingoContextItem}
        // Context memory (Figma 271:38656): the strip at the top of the composer
        // card naming what Mingo remembers from this session's navigation — the
        // open entity page plus the recently viewed ones — with a `⋯` dropdown
        // to review and forget individual entries. Replaces the old under-the-
        // header page-context banner. The strip self-hides when memory is empty.
        contextMemory={contextMemory}
      />
    </>
  );
}
