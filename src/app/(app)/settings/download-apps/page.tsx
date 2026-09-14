'use client';

import { notFound } from 'next/navigation';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isAppShell } from '@/lib/platform';
import { DownloadAppsView } from '../components/download-apps-view';

export default function DownloadAppsPage() {
  const gate = useFeatureFlagGate('download-apps');

  // Browser-only: this page hands out installers for the very shells it would be
  // running inside, so a native build has nothing to get from it. Unlike the flag
  // it is a build constant with no unanswered state, so it 404s immediately.
  //
  // Only a definitive flag "off" 404s. `notFound()` THROWS, so firing it while the
  // flag is merely unanswered permanently 404s the page for a tenant that has it —
  // the error boundary takes over and this component never re-renders to correct itself.
  if (isAppShell() || gate === 'off') {
    notFound();
  }

  return <DownloadAppsView pending={gate === 'loading'} />;
}
