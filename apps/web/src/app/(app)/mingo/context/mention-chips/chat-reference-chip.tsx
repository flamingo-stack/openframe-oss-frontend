'use client';

/**
 * A chat record link, `[title](record://chat/<dialogId>)` — Mingo citing an
 * EARLIER CONVERSATION of the same technician when it answers from chat memory.
 * The ai-agent's memory search hands the model a `sourceId` per supporting
 * source — only for dialogs the asking technician owns, and never the one
 * open — and the model links it beside the statement it supports.
 *
 * `chat` is a record type, not a `ContextItemType`: nothing attaches a
 * conversation as context, the picker does not offer one, and it has no entry
 * in `CONTEXT_ENTITY_MARKER` (it is the lib's `OPENFRAME_CHAT_RECORD_TYPE`). It is the one link-only type.
 *
 * The chip links to that chat's page (`mingoDialogLink`, the canonical chat route).
 *
 * The title comes from `conversationMemoryChatReference(id)` on the ai-agent
 * GraphQL. `null` is the backend refusing to name the chat for this caller — not
 * theirs, or gone — and the ONE case with nothing to open, so the chip says so
 * and links nowhere. A failed lookup is not that case: the chip keeps its link
 * under a generic label, since the chat resolves the dialog on its own.
 */

import { OPENFRAME_CHAT_RECORD_TYPE } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { RecordChip } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { mingoDialogLink } from '@/lib/routes';

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
}

/** The linked form: the chat's page, whether the title resolved or not. */
function LinkedChatTag({ id, label }: { id: string; label: string }) {
  return <RecordChip type={OPENFRAME_CHAT_RECORD_TYPE} id={id} label={label} href={mingoDialogLink(id)} />;
}

/**
 * The chip's boundary: while its entity is fetched, the reader draws the chip itself (no label yet) in a loading
 * scope, where the `Tag` draws its own skeleton in the chip's box. Inline (a `span` with no box of its own: the chip
 * lives inside a `<p>`), and with no status of its own: a message can hold several chips loading at once, and a
 * "loading" read out mid-sentence for each would bury the message itself.
 */
function ChatReferenceLoader(props: ChatReferenceChipProps) {
  return (
    <LoadingSuspense as="span" className="contents" status={false}>
      <ChatReferenceReader {...props} />
    </LoadingSuspense>
  );
}

function ChatReferenceReader(props: ChatReferenceChipProps) {
  // In a loading scope it draws the chip with no label and runs no read.
  if (useLoadingScope()) return <RecordChip type={OPENFRAME_CHAT_RECORD_TYPE} id={props.id} label="" loading />;
  return <ChatReferenceInner {...props} />;
}

function ChatReferenceInner({ id }: ChatReferenceChipProps) {
  const { data } = useSuspenseQuery({
    queryKey: ['mingo-mention', OPENFRAME_CHAT_RECORD_TYPE, id],
    queryFn: () => resolveChatReference(id),
    staleTime: 5 * 60 * 1000,
    // One retry, not the default three: this chip sits inline in a sentence, and
    // a dead endpoint should settle into the linked fallback within a second,
    // not hold a skeleton in the prose for the whole backoff ladder.
    retry: 1,
  });
  if (!data) return <RecordChip type={OPENFRAME_CHAT_RECORD_TYPE} id={id} label={UNAVAILABLE_CHAT} href={null} />;
  return <LinkedChatTag id={data.id} label={data.title} />;
}

export function ChatReferenceChip({ id }: ChatReferenceChipProps) {
  return (
    <ErrorBoundary fallback={<LinkedChatTag id={id} label={UNRESOLVED_CHAT} />}>
      <ChatReferenceLoader id={id} />
    </ErrorBoundary>
  );
}
