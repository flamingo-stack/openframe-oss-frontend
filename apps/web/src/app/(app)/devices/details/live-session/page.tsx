'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LiveSessionView } from '@/app/(app)/devices/components/remote-sessions/live-session-view';
import { useRemoteSessionWatchGate } from '@/app/(app)/devices/hooks/use-remote-session-watch-gate';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';

export default function LiveSessionPage() {
  const router = useRouter();
  const gate = useRemoteSessionWatchGate();
  const sessionId = useRequiredIdParam(routes.devices.list);

  useEffect(() => {
    if (gate === 'off') router.replace(routes.devices.list);
  }, [gate, router]);

  // Until the gate is on and the id is read, the view draws its own loading state and asks for nothing.
  const ready = gate === 'on' && Boolean(sessionId);
  return (
    <LoadingWhen loading={!ready}>
      <LiveSessionView sessionId={ready ? sessionId : null} />
    </LoadingWhen>
  );
}
