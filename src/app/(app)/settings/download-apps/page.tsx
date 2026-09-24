'use client';

import { notFound } from 'next/navigation';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import { isMobileShell } from '@/lib/platform';
import { DownloadAppsView } from '../components/download-apps-view';

export default function DownloadAppsPage() {
  const gate = useFeatureFlagGate('download-apps');

  // Phone-only exclusion: that build already IS the app the mobile card hands out,
  // and a desktop installer is no use on a phone. The DESKTOP shell keeps this page —
  // the phone app is a different app from the one it is running, and a QR belongs on
  // the screen you are not holding. Unlike the flag it is a build constant with no
  // unanswered state, so it 404s immediately.
  //
  // The bare predicate, not `useIsMobileShell()`: the hook exists to keep a rendered
  // subtree from being regenerated at hydration, and this renders nothing — it throws.
  //
  // Only a definitive flag "off" 404s. `notFound()` THROWS, so firing it while the
  // flag is merely unanswered permanently 404s the page for a tenant that has it —
  // the error boundary takes over and this component never re-renders to correct itself.
  if (isMobileShell() || gate === 'off') {
    notFound();
  }

  return <DownloadAppsView pending={gate === 'loading'} />;
}
