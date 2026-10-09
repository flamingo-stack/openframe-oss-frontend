'use client';

import type { ReactNode } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';

interface KnowledgeBasePageShellProps {
  errorMessage: string;
  /** The record the page shows: a new `?id=` clears a boundary tripped by the previous one. */
  resetKey?: string;
  children: ReactNode;
}

/**
 * Every knowledge base route's frame: the page padding with the error boundary
 * inside it, so a thrown query keeps the title indented instead of taking the
 * padding down with the layout that declared it.
 */
export function KnowledgeBasePageShell({ errorMessage, resetKey, children }: KnowledgeBasePageShellProps) {
  return (
    <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <ContentErrorBoundary title="Knowledge Base" message={errorMessage} resetKey={resetKey}>
        {children}
      </ContentErrorBoundary>
    </div>
  );
}
