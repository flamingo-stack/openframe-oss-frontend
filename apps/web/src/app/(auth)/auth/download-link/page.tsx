'use client';

import { AuthShell } from '@flamingo-stack/openframe-frontend-core/components/features';
import { DownloadLinkSection } from '@/app/(auth)/auth/components/download-link-section';

/**
 * "Send me download link", for a visitor who cannot install where they are (a phone, a system with
 * no installer): the marketing site's button opens this page, with the visit's attribution in its
 * URL the way the trial link carries it, which the app-wide capture stores on arrival. Drawn in the
 * sign-up's shell, without its tabs: this is not a sign-up.
 */
export default function DownloadLinkPage() {
  return (
    <AuthShell>
      <DownloadLinkSection />
    </AuthShell>
  );
}
