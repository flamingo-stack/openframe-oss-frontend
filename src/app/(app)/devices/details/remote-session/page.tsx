'use client';

import { CompactPageLoader } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { RemoteSessionView } from '@/app/(app)/devices/components/remote-sessions/remote-session-view';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';

export default function RemoteSessionPage() {
  const router = useRouter();
  const serverGate = useFeatureFlagGate('session-recordings');
  // The backend does not register 'session-recordings' yet (unknown names come
  // back disabled), so the dev server bypasses the gate - the player must be
  // testable against local sample files before the storage backend exists.
  const gate = process.env.NODE_ENV === 'development' ? 'on' : serverGate;
  const recordingId = useRequiredIdParam(routes.devices.list);

  useEffect(() => {
    if (gate === 'off') router.replace(routes.devices.list);
  }, [gate, router]);

  if (gate !== 'on' || !recordingId) return <CompactPageLoader />;
  return <RemoteSessionView recordingId={recordingId} />;
}
