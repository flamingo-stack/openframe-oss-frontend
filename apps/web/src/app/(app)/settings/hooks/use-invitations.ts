'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { handleApiError } from '@/lib/handle-api-error';

async function revokeInvitationApi(invitationId: string): Promise<void> {
  const res = await apiClient.delete(`/api/invitations/${encodeURIComponent(invitationId)}`);
  if (!res.ok) {
    throw new Error(res.error || `Failed to revoke invitation (${res.status})`);
  }
}

async function resendInvitationApi(invitationId: string): Promise<void> {
  const res = await apiClient.post(`/api/invitations/${encodeURIComponent(invitationId)}/resend`);
  if (!res.ok) {
    throw new Error(res.error || `Failed to resend invitation (${res.status})`);
  }
}

async function inviteUsersApi(emails: string[]): Promise<void> {
  const trimmed = emails.map(e => e.trim()).filter(e => e.length > 0);
  if (trimmed.length === 0) return;

  const results = await Promise.all(
    trimmed.map(async email => ({ email, res: await apiClient.post('api/invitations', { email }) })),
  );

  const errors = results.filter(r => !r.res.ok).map(r => r.email);
  if (errors.length) {
    throw new Error(`Failed to invite: ${errors.join(', ')}`);
  }
}

/** Takes the raw invitation id (not the Relay one). */
export function useRevokeInvitation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: revokeInvitationApi,
    onError: error => handleApiError(error, toast, 'Failed to revoke invitation'),
  });
}

/** Takes the raw invitation id (not the Relay one). */
export function useResendInvitation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: resendInvitationApi,
    onError: error => handleApiError(error, toast, 'Failed to resend invitation'),
  });
}

/** The caller toasts: it knows how many it sent. */
export function useInviteUsers() {
  return useMutation({ mutationFn: inviteUsersApi });
}
