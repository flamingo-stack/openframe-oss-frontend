'use client';

import type {
  ChatContextPickerConfig,
  EmbeddableChatProps,
  MingoQuickAction,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { getAgentAccent, renderQuickActionIcon } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { KNOWLEDGE_BASE_ROUTE } from '@/app/(app)/help-center/endpoints';
import { useMingoContextEntityTypes } from '@/app/(app)/mingo/context/context-sources';
import { CONTEXT_ITEMS_MAX } from '@/app/(app)/mingo/context/context-types';
import { renderMingoContextItem, renderMingoMention } from '@/app/(app)/mingo/context/mention-chips/render-mention';
import { renderMingoContextItems } from '@/app/(app)/mingo/context/render-context-items';
import { useMingoContextMemory } from '@/app/(app)/mingo/context/use-context-memory';
import { useMingoQuickActions } from '@/app/(app)/mingo/hooks/use-mingo-quick-actions';
import { useMingoWhatToAsk } from '@/app/(app)/mingo/hooks/use-mingo-what-to-ask';
import type { MingoChat, MingoChatState } from '@/app/(app)/mingo/providers/mingo-chat-provider';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getFullImageUrl } from '@/lib/image-url';

/**
 * What OpenFrame's chat can do, as `EmbeddableChat` props: the context picker, `@`,
 * the memory strip, quick actions, identity, the dialog actions. The composer dock
 * adds its own layout props on top.
 */
export type OpenframeChatProps = Pick<
  EmbeddableChatProps,
  | 'baseRoute'
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
  copyDialogLink: MingoChat['copyDialogLink'];
  /** How a quick-action chip starts its chat. Default: the session's `sendInNewDialog`. */
  sendInNewDialog?: (text: string) => Promise<void>;
}

/** Builds {@link OpenframeChatProps} from the session's chat state. */
export function useOpenframeChatProps({
  chat,
  copyDialogLink,
  sendInNewDialog = chat.sendInNewDialog,
}: OpenframeChatPropsOptions): OpenframeChatProps {
  const {
    state,
    pendingApprovals,
    dialogStatusOf,
    searchQuery,
    setSearchQuery,
    fetchArchivedDialogs,
    unarchiveDialog,
  } = chat;

  const loadWhatToAsk = useMingoWhatToAsk();
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

  return {
    dialogStatusOf,
    // "What to ask Mingo?" answers in the chat (the open one, else a new one) with
    // prompts that go into the composer, naming online devices.
    whatToAsk: loadWhatToAsk,
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
    // reducer built renders nowhere unless it is handed back here — including the
    // Product Guide's "create a support ticket" card whose own preamble tells the
    // user to click Approve.
    pendingApprovals,
    // Dialog management for the host-injected Mingo state:
    //  - search: the chat-history search bar emits the debounced term into
    //    `setSearchQuery`, which rides the `useMingoDialogs` query key.
    //  - rename/archive: enable the row + header ⋯ menu (mutations live on
    //    `mingoState` via `useMingoDialogActions`).
    //  - compact: not here — it is the composer's, under the input.
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
}
