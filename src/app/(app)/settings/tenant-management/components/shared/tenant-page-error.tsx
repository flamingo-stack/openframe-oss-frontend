'use client';

import { LoadError, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { loadErrorProps } from '@/lib/query-state';

/**
 * Failed-load state for a Tenant Management page: the title redrawn over the error card, since the
 * layout that carries it is inside what threw. The negative margin cancels core `ErrorState`'s 24px padding.
 */
export function tenantPageErrorFallback(title: string, message: string) {
  return function TenantPageError(retry: () => void, state: { isOffline: boolean }): ReactNode {
    return (
      <PageLayout title={title}>
        <div className="-m-[var(--spacing-system-lf)]">
          <LoadError {...loadErrorProps(state.isOffline, message, retry)} />
        </div>
      </PageLayout>
    );
  };
}
