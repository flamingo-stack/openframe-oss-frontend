'use client';

import type { ReactNode } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { tenantPageErrorFallback } from './tenant-page-error';

interface TenantPageShellProps {
  /** The title the error state redraws, since the layout that carries it is inside what threw. */
  title: string;
  errorMessage: string;
  /** The record the page shows: a new `?id=` clears a boundary tripped by the previous one. */
  resetKey?: string;
  children: ReactNode;
}

/** Page padding with the error boundary inside it, so a thrown query keeps the title indented. */
export function TenantPageShell({ title, errorMessage, resetKey, children }: TenantPageShellProps) {
  return (
    <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <ContentErrorBoundary resetKey={resetKey} fallback={tenantPageErrorFallback(title, errorMessage)}>
        {children}
      </ContentErrorBoundary>
    </div>
  );
}
