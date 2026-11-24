'use client';

import { LoadError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { useFeatureFlagGate } from '@/app/hooks/use-feature-flag';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { loadErrorProps } from '@/lib/query-state';

/**
 * The one gate for Email to ticket: every page under `/settings/email-to-ticket` and the Settings card. Tri-state on
 * purpose: `'loading'` draws the page in its loading scope, never a 404 (see `use-feature-flag.ts`).
 */
export function useEmailToTicketGate(): FeatureFlagGate {
  return useFeatureFlagGate('email-to-ticket');
}

interface EmailToTicketPageShellProps {
  /** The title the error state redraws, since the layout that carries it is inside what threw. */
  title: string;
  errorMessage: string;
  /** The record the page shows: a new `?id=` clears a boundary tripped by the previous one. */
  resetKey?: string;
  /** The page's children, given the flag's answer: `true` while it is still being read. */
  children: (loading: boolean) => ReactNode;
}

/**
 * The frame of every Email to ticket page: the flag (off is a 404, unanswered is the page in its loading scope), the
 * page padding, and the error boundary inside it, so a thrown query keeps the title indented.
 */
export function EmailToTicketPageShell({ title, errorMessage, resetKey, children }: EmailToTicketPageShellProps) {
  const gate = useEmailToTicketGate();
  if (gate === 'off') {
    notFound();
  }
  return (
    <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <ContentErrorBoundary
        resetKey={resetKey}
        fallback={(retry, state) => (
          <PageLayout title={title}>
            {/* The negative margin cancels core `ErrorState`'s own padding. */}
            <div className="-m-[var(--spacing-system-lf)]">
              <LoadError {...loadErrorProps(state.isOffline, errorMessage, retry)} />
            </div>
          </PageLayout>
        )}
      >
        {children(gate === 'loading')}
      </ContentErrorBoundary>
    </div>
  );
}
