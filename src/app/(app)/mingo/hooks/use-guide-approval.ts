'use client';

/**
 * Resolve a Product Guide approval card the same way the Guide chat does.
 *
 * A guide card is a hub PROPOSAL: the hub minted it, the hub owns its
 * single-use `proposalId`, and only the hub's confirm-tool route can settle it.
 * The agent's `/chat/api/v1/approval-requests/{id}/approve` knows nothing about
 * that id — pointing the card's buttons there returns 404, which is what this
 * hook exists to stop.
 *
 * Everything here is the Guide-mode path, reused rather than re-implemented:
 *   - the SAME endpoint the lib's runtime already declares
 *     (`approvalToolUrl` → `/content/api/chat/agent/confirm-tool`, proxied to
 *     the hub like every other `/content/*` call);
 *   - the SAME request body, built by the shared `buildConfirmToolBody` rather
 *     than hand-written here (a proposal is single-use: a caller that drifts on
 *     a field name does not degrade, it fails the write);
 *   - the SAME authed fetch (`embedAuthedFetch`, bearer + refresh);
 *   - the SAME wire decoder (`createSseFrameDecoder`), because the response is
 *     an ordinary guide stream: a `decision_resolved` frame, then the hub's
 *     auto-continuation.
 *
 * The one Mingo-specific step is the last one: those events are replayed into
 * THIS dialog's reducer through `guideEventForNats`, the same adapter the
 * re-streamed `GUIDE` chunks go through. So the card flips and the continuation
 * renders through the identical path a live turn uses.
 *
 * NOT persisted: the continuation arrives on this HTTP response, not over NATS,
 * so the agent never sees it and it will be missing after a reload. Fixing that
 * means moving the confirm behind the agent so it re-streams the result — worth
 * doing, and independent of this hook's contract.
 */

import type { ApprovalToolAction, ChatStreamEvent } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import {
  buildConfirmToolBody,
  createSseFrameDecoder,
  guideEventForNats,
  readServerErrorMessage,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { useRequiredChatRuntime } from '@flamingo-stack/openframe-frontend-core/contexts';
import { embedAuthedFetch } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback } from 'react';
import { bindMingoDialog, mutateMingoDialog } from '../stores/mingo-messages-store';

/** Re-exported from the wire contract rather than restated — the hub owns this
 *  vocabulary. */
export type GuideApprovalAction = ApprovalToolAction;

/** Resolve one guide proposal; rejects with a user-facing message on failure. */
export type ResolveGuideApproval = (dialogId: string, proposalId: string, action: GuideApprovalAction) => Promise<void>;

export function useGuideApproval(): ResolveGuideApproval {
  const runtime = useRequiredChatRuntime();
  const approvalToolUrl = runtime.endpoints.approvalToolUrl;

  return useCallback(
    async (dialogId, proposalId, action) => {
      // The hub requires its own conversation id back on every confirm and
      // rejects the call without it. The agent owns the dialog↔conversation
      // binding server-side; the client learns the id from the guide metadata
      // frame of a streamed turn, which the reducer records. Absent = this turn
      // was never seen live (e.g. the page was reloaded), and there is nothing
      // honest to send.
      const conversationId = mutateMingoDialog(dialogId, reducer => reducer.state.guideConversationId);
      if (!conversationId) {
        throw new Error('This card is from an earlier session and can no longer be confirmed here.');
      }

      const response = await embedAuthedFetch(approvalToolUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildConfirmToolBody({ proposalId, action, conversationId })),
      });

      if (!response.ok || !response.body) {
        // The hub writes its confirm errors for the end user ("This approval
        // expired — ask again to get a fresh one"), and they beat anything a
        // status code could say here. Same copy the Guide chat shows.
        const serverMessage = response.ok ? null : await readServerErrorMessage(response);
        throw new Error(serverMessage ?? `Product Guide could not ${action} this request (HTTP ${response.status}).`);
      }

      const decoder = createSseFrameDecoder();
      const bound = bindMingoDialog(dialogId);
      const apply = (events: ChatStreamEvent[]) => {
        for (const event of events) {
          const mapped = guideEventForNats(event);
          if (mapped) bound.apply(mapped);
        }
      };

      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) apply(decoder.push(value));
        }
        apply(decoder.end());
      } finally {
        // The hub's stream just ends — there is no MESSAGE_END on this wire.
        // Close the turn ourselves or the composer stays locked on 'streaming'.
        bound.apply({ type: 'turn-end' });
      }
    },
    [approvalToolUrl],
  );
}
