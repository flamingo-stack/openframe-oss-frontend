import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PAGE_SHELL_OVERRIDE } from '@/app/components/shared/page-shell-override';
import { routeTitle } from '@/lib/route-title';
import { HelpCenterRuntimeProvider } from './help-center-runtime-provider';

/** Section title for `/help-center/*` — see `../route-title-layout.tsx`. */
export const metadata: Metadata = { title: routeTitle('Help Center') };

/**
 * Wraps every `/help-center/*` route in the section's nested ChatRuntime
 * override (host-mode navigation + in-app content hrefs). Server component;
 * the provider it mounts is the only client boundary. The `PAGE_SHELL_OVERRIDE`
 * wrapper sets the lib `PageShell`'s host padding via CSS vars, scoped here: every
 * surface's PageShell — DevSectionPage, Legal, ReleaseDetail, FAQs, tickets —
 * inherits it with no per-page prop.
 */
export default function HelpCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div style={PAGE_SHELL_OVERRIDE}>
      <HelpCenterRuntimeProvider>{children}</HelpCenterRuntimeProvider>
    </div>
  );
}
