'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RemoteSessionView } from '@/app/(app)/devices/components/remote-sessions/remote-session-view';
import { useRemoteAccessApprovalGate } from '@/app/(app)/devices/hooks/use-remote-access-approval-gate';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';

export default function RemoteSessionPage() {
  const router = useRouter();
  const gate = useRemoteAccessApprovalGate();
  const recordingId = useRequiredIdParam(routes.devices.list);

  useEffect(() => {
    if (gate === 'off') router.replace(routes.devices.list);
  }, [gate, router]);

  if (gate !== 'on' || !recordingId) return <CompactPageLoader />;
  return <RemoteSessionView recordingId={recordingId} />;
}
