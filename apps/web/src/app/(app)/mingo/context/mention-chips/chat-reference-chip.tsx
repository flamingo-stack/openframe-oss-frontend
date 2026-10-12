'use client';

/**
 * Inline `@chat:<dialogId>` — Mingo citing an EARLIER CONVERSATION of the same
 * technician when it answers from chat memory. The ai-agent's memory search
 * hands the model a `chatTag` per supporting source — only for dialogs the
 * asking technician owns, and never the one open — and the model pastes that
 * marker beside the statement it supports.
 *
 * `chat` is a reference marker, not a `ContextItemType`: nothing attaches a
 * conversation as context, the picker does not offer one, and it has no entry
 * in `CONTEXT_ENTITY_MARKER`. It is the one mention-only marker.
 *
 * Unlike every entity chip, the target is not a page. The conversation opens IN
 * THE DRAWER, in place, over whatever page the drawer floats — the same path a
 * notification click takes — so the reader keeps their page and their place.
 * The `href` (`mingoDialogLink`) stays on the anchor for a middle-click or a
 * copy; a fresh load of it resolves into the drawer through the URL sync.
 *
 * The title comes from `conversationMemoryChatReference(id)` on the ai-agent
 * GraphQL. `null` is the backend refusing to name the chat for this caller — not
 * theirs, or gone — and the ONE case with nothing to open, so the chip says so
 * and links nowhere. A failed lookup is not that case: the chip keeps its link
 * under a generic label, since the drawer resolves the dialog on its own.
 */

import { useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, Suspense } from 'react';
import { openMingoDialogInDrawer } from '@/app/components/notifications/open-mingo-dialog';
import { apiClient } from '@/lib/api-client';
import { mingoDialogLink } from '@/lib/routes';
import { MentionErrorBoundary, MentionTag, MentionTagSkeleton } from './mention-tag';

/** The marker the ai-agent writes in front of a recalled dialog's id
 *  (`ConversationMemoryReferenceService.CHAT_TAG_PREFIX`, without the `@`). */
export const CHAT_REFERENCE_MARKER = 'chat';

/** The backend substitutes this for a blank title itself; kept here for a
 *  `null` title the schema still allows. */
const UNTITLED_CHAT = 'Untitled conversation';
/** Label while the title is unknown but the chat may well be there. */
const UNRESOLVED_CHAT = 'Chat';
/** Label when the backend will not name the chat for this caller. */
const UNAVAILABLE_CHAT = 'Chat unavailable';

/** ai-agent GraphQL (`/chat/graphql`) — permanently raw-POST, see CLAUDE.md. */
const CHAT_REFERENCE_QUERY =
  'query MingoChatReference($id: ID!) { conversationMemoryChatReference(id: $id) { id title } }';

interface ChatReferenceEnvelope {
  data?: { conversationMemoryChatReference?: { id: string; title: string | null } | null };
  errors?: { message?: string }[];
}

export interface ChatReference {
  id: string;
  title: string;
}

/**
 * `null` = the backend answered, and will not name this chat for the caller.
 * Throws when it did not answer — the boundary below tells the two apart.
 */
export async function resolveChatReference(id: string): Promise<ChatReference | null> {
  const response = await apiClient.post<ChatReferenceEnvelope>('/chat/graphql', {
    query: CHAT_REFERENCE_QUERY,
    variables: { id },
  });
  if (!response.ok) throw new Error(response.error || 'Chat reference lookup failed');
  const body = response.data;
  if (!body?.data || body.errors?.length) {
    throw new Error(body?.errors?.[0]?.message || 'Chat reference lookup failed');
  }
  const reference = body.data.conversationMemoryChatReference;
  return reference ? { id: reference.id, title: reference.title?.trim() || UNTITLED_CHAT } : null;
}

interface ChatReferenceChipProps {
  /** The dialog id the marker carries. */
  id: string;
  icon?: ReactNode;
}

/** The linked form: the same in-place open whether the title resolved or not. */
function LinkedChatTag({ id, label, icon }: { id: string; label: string; icon?: ReactNode }) {
  return <MentionTag icon={icon} label={label} href={mingoDialogLink(id)} onOpen={() => openMingoDialogInDrawer(id)} />;
}

function ChatReferenceInner({ id, icon }: ChatReferenceChipProps) {
  const { data } = useSuspenseQuery({
    queryKey: ['mingo-mention', CHAT_REFERENCE_MARKER, id],
    queryFn: () => resolveChatReference(id),
    staleTime: 5 * 60 * 1000,
    // One retry, not the default three: this chip sits inline in a sentence, and
    // a dead endpoint should settle into the linked fallback within a second,
    // not hold a skeleton in the prose for the whole backoff ladder.
    retry: 1,
  });
  if (!data) return <MentionTag icon={icon} label={UNAVAILABLE_CHAT} />;
  return <LinkedChatTag id={data.id} label={data.title} icon={icon} />;
}

export function ChatReferenceChip({ id, icon }: ChatReferenceChipProps) {
  return (
    <MentionErrorBoundary fallback={<LinkedChatTag id={id} label={UNRESOLVED_CHAT} icon={icon} />}>
      <Suspense fallback={<MentionTagSkeleton icon={icon} />}>
        <ChatReferenceInner id={id} icon={icon} />
      </Suspense>
    </MentionErrorBoundary>
  );
}
