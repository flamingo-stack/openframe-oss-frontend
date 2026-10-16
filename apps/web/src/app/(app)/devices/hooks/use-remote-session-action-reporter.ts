'use client';

import { useRef } from 'react';
import { RemoteSessionActionReporter } from '../services/remote-session-action-reporter';
import type { RemoteSessionAction } from '../services/remote-session-actions-api-service';

/**
 * Reports the console's actions to the session's timeline. A no-op without a
 * session (remote access approval off, or the session not opened yet). Call it
 * from event handlers only, after the action went to the agent.
 */
export function useRemoteSessionActionReporter(sessionId: string | null): (action: RemoteSessionAction) => void {
  const reporterRef = useRef<RemoteSessionActionReporter | null>(null);
  const reporterSessionRef = useRef<string | null>(null);

  return (action: RemoteSessionAction) => {
    if (!sessionId) return;
    if (reporterSessionRef.current !== sessionId || !reporterRef.current) {
      reporterRef.current = new RemoteSessionActionReporter(sessionId);
      reporterSessionRef.current = sessionId;
    }
    reporterRef.current.report(action);
  };
}
