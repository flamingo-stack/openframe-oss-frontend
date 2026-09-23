'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { mingoDialogLink } from '@/lib/routes';
import { MentionTag, MentionTagSkeleton } from './mention-tag';

interface ChatReferenceEnvelope {
  data?: { conversationMemoryChatReference?: { id: string; title: string | null } | null };
  errors?: { message: string }[];
}

const CHAT_REFERENCE_RETRY_ATTEMPTS = 2;
const CHAT_REFERENCE_RETRY_DELAY_MS = 1000;
const CHAT_REFERENCE_MAX_RETRY_DELAY_MS = 5000;
const CHAT_REFERENCE_RECOVERY_INTERVAL_MS = 30_000;
const CHAT_REFERENCE_STALE_TIME_MS = 5 * 60_000;

async function resolveChatReference(id: string): Promise<{ id: string; title: string | null } | null> {
  const response = await apiClient.post<ChatReferenceEnvelope>('/chat/graphql', {
    query: 'query ConversationMemoryChatReference($id: ID!) { conversationMemoryChatReference(id: $id) { id title } }',
    variables: { id },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return null;
    throw new Error(response.error || 'Chat reference lookup failed');
  }
  if (response.data?.errors?.length || !response.data?.data) throw new Error('Chat reference lookup failed');
  if (!('conversationMemoryChatReference' in response.data.data)) throw new Error('Chat reference lookup failed');
  return response.data.data.conversationMemoryChatReference ?? null;
}

function ChatMemoryMentionContent({ id, tenantId, userId }: { id: string; tenantId: string; userId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['mingo-chat-memory-reference', tenantId, userId, id],
    queryFn: () => resolveChatReference(id),
    retry: CHAT_REFERENCE_RETRY_ATTEMPTS,
    retryDelay: attempt => Math.min(CHAT_REFERENCE_RETRY_DELAY_MS * 2 ** attempt, CHAT_REFERENCE_MAX_RETRY_DELAY_MS),
    refetchInterval: query => (query.state.status === 'error' ? CHAT_REFERENCE_RECOVERY_INTERVAL_MS : false),
    staleTime: CHAT_REFERENCE_STALE_TIME_MS,
  });

  if (isPending) return <MentionTagSkeleton />;
  if (!data) return `@chat:${id}`;
  return <MentionTag label={data.title?.trim() || 'Chat'} href={mingoDialogLink(data.id)} openInCurrentWindow />;
}

export function ChatMemoryMention({ id }: { id: string }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userId = useAuthStore(state => state.user?.id);
  const userTenantId = useAuthStore(state => state.user?.tenantId ?? state.user?.organizationId);
  const tenantId = useAuthStore(state => state.tenantId);

  if (!isAuthenticated || !userId || !userTenantId || (tenantId && tenantId !== userTenantId)) return `@chat:${id}`;
  return <ChatMemoryMentionContent key={`${userTenantId}:${userId}`} id={id} tenantId={userTenantId} userId={userId} />;
}
