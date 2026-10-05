'use client';

import { notFound } from 'next/navigation';
import { isMobileShell } from '@/lib/platform';
import { DownloadAppsView } from '../components/download-apps-view';

export default function DownloadAppsPage() {
  // Phone-only exclusion: that build already IS the app the mobile card hands out,
  // and a desktop installer is no use on a phone. The DESKTOP shell keeps this page —
  // the phone app is a different app from the one it is running, and a QR belongs on
  // the screen you are not holding. A build constant with no unanswered state, so it
  // 404s immediately.
  //
  // The bare predicate, not `useIsMobileShell()`: the hook exists to keep a rendered
  // subtree from being regenerated at hydration, and this renders nothing — it throws.
  if (isMobileShell()) {
    notFound();
  }

  return <DownloadAppsView />;
}
