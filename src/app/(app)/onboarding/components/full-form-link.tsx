'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import Link from 'next/link';
import { useIsMobileShell } from '@/app/hooks/use-is-mobile-shell';

/**
 * "Full … Form" escape hatch in an onboarding step footer — the trimmed step form
 * hands off to the real entity page.
 *
 * The mobile shell drops `target="_blank"`: it has no tabs, and the WebView swallows
 * the navigation outright. Capacitor's iOS `createWebViewWith` answers a new-window
 * request with `UIApplication.open(url)`, and no system handler claims
 * `capacitor://localhost`, so the tap is silently dead. In the browser the link keeps
 * opening a new tab, which is what preserves the half-filled step behind it.
 */
export function FullFormLink({ href, label }: { href: string; label: string }) {
  const newTab = !useIsMobileShell();

  return (
    <Link
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      className="flex flex-1 items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary transition-colors hover:text-ods-text-primary"
    >
      <ExternalLinkIcon size={24} className="shrink-0" />
      <span className="text-h4 underline">{label}</span>
    </Link>
  );
}
