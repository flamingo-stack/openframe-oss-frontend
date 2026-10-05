'use client';

import type { ReactNode } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { softwarePageErrorFallback } from './software-page-error';
import type { SoftwareSectionId } from './software-sections';
import { SoftwareTabNavigation } from './software-tab-navigation';

interface SoftwarePageShellProps {
  /** The section switcher's active tab — omitted on detail pages, which have no switcher. */
  section?: SoftwareSectionId;
  /** The page title the error state redraws, since the layout that carries it is inside what threw. */
  title: string;
  errorMessage: string;
  children: ReactNode;
}

/**
 * Every Software route's frame: the section switcher, the page padding, and the
 * error boundary inside that padding — so a thrown query keeps the title
 * indented instead of taking the padding down with the layout that declared it.
 */
export function SoftwarePageShell({ section, title, errorMessage, children }: SoftwarePageShellProps) {
  return (
    <div className="flex w-full flex-col">
      {section && <SoftwareTabNavigation activeTab={section} />}
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <ContentErrorBoundary fallback={softwarePageErrorFallback(title, errorMessage)}>
          {children}
        </ContentErrorBoundary>
      </div>
    </div>
  );
}
