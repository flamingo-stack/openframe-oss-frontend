'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useOwnerGate } from '@/app/hooks/use-owner-gate';
import { TenantOwnersOnlyScreen } from '../components/shared/tenant-owners-only-screen';
import { TenantPageShell } from '../components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../components/shared/use-tenant-management-gate';
import { TenantFormSkeleton } from '../components/tenant-form/tenant-form-skeleton';
import { NewTenantView } from '../components/tenant-new/new-tenant-view';
import type { NewTenantHandoff } from '../components/tenant-new/use-new-tenant-flow';

export default function NewTenantPage() {
  const gate = useTenantManagementGate();
  const ownerGate = useOwnerGate();
  // Set once Generate has created the record, so a reload or Back resumes it.
  const resumeId = useSearchParams().get('id');
  // What Generate created, so the remount onto its id starts at the link step instead of reading it back.
  const [handoff, setHandoff] = useState<NewTenantHandoff | null>(null);
  if (gate === 'off') {
    notFound();
  }
  if (gate === 'on' && ownerGate === 'not-owner') {
    return <TenantOwnersOnlyScreen />;
  }
  return (
    <TenantPageShell
      title="New Tenant Integration"
      errorMessage="Couldn't load the connection form."
      resetKey={resumeId ?? undefined}
    >
      {/* Neither the flag nor the role may be read as "no" before it is known. */}
      {gate === 'loading' || ownerGate === 'loading' ? (
        <TenantFormSkeleton variant="new" />
      ) : (
        // Keyed by id: another record (or none) is another flow.
        <NewTenantView
          key={resumeId ?? 'new'}
          resumeId={resumeId}
          handoff={handoff && handoff.id === resumeId ? handoff : null}
          onCreated={setHandoff}
        />
      )}
    </TenantPageShell>
  );
}
