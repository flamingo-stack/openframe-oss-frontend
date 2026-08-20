'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ContentErrorBoundary } from '@/app/components/shared';
import { isSaasTenantMode } from '@/lib/app-mode';
import { routes } from '@/lib/routes';
import { TicketsView } from './components/tickets-view';

export default function Tickets() {
  const router = useRouter();

  useEffect(() => {
    if (!isSaasTenantMode()) {
      router.replace(routes.dashboard);
      return;
    }
  }, [router]);

  // Don't render anything if not in saas-tenant mode
  if (!isSaasTenantMode()) {
    return null;
  }

  return (
    <ContentErrorBoundary title="Tickets" message="Couldn't load tickets.">
      <TicketsView />
    </ContentErrorBoundary>
  );
}
