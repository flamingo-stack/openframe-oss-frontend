'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RemoteSessionView } from '@/app/(app)/devices/components/remote-sessions/remote-session-view';
import { useSessionRecordingsGate } from '@/app/(app)/devices/hooks/use-session-recordings-gate';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';

export default function RemoteSessionPage() {
  const router = useRouter();
  const gate = useSessionRecordingsGate();
  const recordingId = useRequiredIdParam(routes.devices.list);

  useEffect(() => {
    if (gate === 'off') router.replace(routes.devices.list);
  }, [gate, router]);

  // Until the gate is on and the id is read, the view draws its own loading state and asks for nothing.
  const ready = gate === 'on' && Boolean(recordingId);
  return (
    <LoadingWhen loading={!ready}>
      <RemoteSessionView recordingId={ready ? recordingId : null} />
    </LoadingWhen>
  );
}
