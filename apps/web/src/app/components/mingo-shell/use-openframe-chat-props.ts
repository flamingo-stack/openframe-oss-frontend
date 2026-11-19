'use client';

import type {
  ChatContextPickerConfig,
  EmbeddableChatProps,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { useMingoContextEntityTypes } from '@/app/(app)/mingo/context/context-sources';
import { CONTEXT_ITEMS_MAX } from '@/app/(app)/mingo/context/context-types';
import { renderMingoContextItem, renderMingoRecordChip } from '@/app/(app)/mingo/context/mention-chips/render-mention';
import { renderMingoContextItems } from '@/app/(app)/mingo/context/render-context-items';
import { useMingoContextMemory } from '@/app/(app)/mingo/context/use-context-memory';
import { MINGO_DIALOGS_PAGE_SIZE, type MingoUnifiedChat } from '@/app/(app)/mingo/hooks/use-mingo-unified-chat-state';
import { useMingoWhatToAsk } from '@/app/(app)/mingo/hooks/use-mingo-what-to-ask';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getFullImageUrl } from '@/lib/image-url';
import { OPENFRAME_QUICK_ACTION_ACCENT, useMingoQuickActionChips } from './use-mingo-quick-action-chips';

/**
 * What OpenFrame's chat can do, as `EmbeddableChat` props: the context picker, `@`,
 * the memory strip, quick actions, identity, the row status. The dialog actions are
 * the engine's (its config), and the engine reaches the panel through
 * `ChatEngineProvider`. The composer dock adds its own layout props on top.
 */
export type OpenframeChatProps = Pick<
  EmbeddableChatProps,
  | 'contextMemory'
  | 'contextPicker'
  | 'dialogStatusOf'
  | 'historyPageSize'
  | 'mingoWelcome'
  | 'modes'
  | 'quickActionAccent'
  | 'renderContextItem'
  | 'renderRecordChip'
  | 'userAvatarUrl'
  | 'userDisplayName'
  | 'whatToAsk'
>;

/** Builds {@link OpenframeChatProps} from the session's chat state. */
export function useOpenframeChatProps({
  dialogStatusOf,
}: Pick<MingoUnifiedChat, 'dialogStatusOf'>): OpenframeChatProps {
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

  // Admin-configured Mingo quick actions become starter chips in the empty state. The chat
  // puts a clicked one's instructions into its composer to edit and send.
  const { chips: mingoQuickActions, loading: mingoQuickActionsLoading } = useMingoQuickActionChips();

  return {
    dialogStatusOf,
    // One page of the dialog list: the conversation lists' loading state draws this many rows.
    historyPageSize: MINGO_DIALOGS_PAGE_SIZE,
    // "What to ask Mingo?" answers in a new chat with prompts that go into the
    // composer, naming online devices.
    whatToAsk: loadWhatToAsk,
    // Signed-in user's name for the header sub-line under the chat title.
    // Fallback for the lib's server identity when the tenant identity route
    // returns no name — sourced from the host auth store.
    userDisplayName,
    userAvatarUrl,
    // Mingo runs on the lib's chat engine in the session's provider (one engine for
    // every surface: the dock, the sidebar's history, the approvals), which the dock
    // hands to the panel (`ChatEngineProvider`), so `modes.mingo` is not passed. The
    // EXPLICIT empty object matters: omitting `modes` entirely makes the lib fall back
    // to its guide-only default. With no `modes.guide`, the panel is Mingo-only.
    modes: {},
    // Admin-configured Mingo quick actions rendered as the lib's quick-action set in the
    // Mingo empty state. While they are read the set holds its slots (its chips' loading
    // form), so the empty state keeps its height when they land. Omitted when none are
    // configured so the lib keeps its default welcome content.
    mingoWelcome:
      mingoQuickActions.length > 0 || mingoQuickActionsLoading
        ? {
            quickActions: mingoQuickActions,
            quickActionsLoading: mingoQuickActionsLoading,
            quickActionAccent: OPENFRAME_QUICK_ACTION_ACCENT,
          }
        : undefined,
    // The quick actions the chat reads itself (Guide mode) are drawn as the dock's are.
    quickActionAccent: OPENFRAME_QUICK_ACTION_ACCENT,
    contextPicker,
    // Renders the chip of a record link (`[MacBook](record://device/<id>)`) in
    // a message as a self-fetching chip. Stable module-level fn so the message
    // memo holds.
    renderRecordChip: renderMingoRecordChip,
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
