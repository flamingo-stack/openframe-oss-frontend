import type { ChatMessage, ChatMessageAuthor } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type { ClientView } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { getFullImageUrl } from '@/lib/image-url';
import { ASSISTANT_CONFIG } from '../constants';

export interface ClientChatAssistant {
  name: string;
  /** A full, loadable address, or undefined: the lib then draws the assistant's packaged mark. */
  avatar: string | undefined;
}

/**
 * The assistant as the end user's Fae client shows it: the customer's own view, else the tenant-wide one. Its name and
 * its face come from the same view, so they never disagree; neither set, it is Fae with Fae's mark.
 */
export function clientChatAssistant(
  customerView: ClientView | null | undefined,
  tenantView: ClientView | null | undefined,
): ClientChatAssistant {
  const view = customerView ?? tenantView;
  return {
    name: view?.assistantName.trim() || ASSISTANT_CONFIG.FAE.name,
    avatar: getFullImageUrl(view?.assistantAvatar?.imageUrl, view?.assistantAvatar?.hash),
  };
}

/** The assistant as the author of a message the page writes itself (the ticket receipt): its name, and its face when set. */
export function assistantAuthor({ name, avatar }: ClientChatAssistant): ChatMessageAuthor {
  return {
    name,
    ...(avatar ? { avatar } : {}),
    assistantType: ASSISTANT_CONFIG.FAE.type,
    authorType: 'fae',
  };
}

/**
 * The assistant's face on its own turns. A turn that already carries a picture keeps it, and a person's turn (the end
 * user, a technician) is never given the assistant's.
 */
export function withAssistantAvatar(message: ChatMessage, avatar: string | undefined): ChatMessage {
  const author = message.metadata?.author;
  if (!avatar || message.role !== 'assistant' || author?.avatar) return message;
  if (author?.authorType === 'user' || author?.authorType === 'admin') return message;
  return { ...message, metadata: { ...message.metadata, author: { ...author, avatar } } };
}
