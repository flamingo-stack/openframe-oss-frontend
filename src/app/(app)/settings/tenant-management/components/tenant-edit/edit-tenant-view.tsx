'use client';

import {
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { TenantSummaryCardSkeleton } from '../tenant-detail/tenant-summary-card';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import { TenantRecordLoader, type TenantRecordState } from './tenant-record-loader';
import { useEditTenantForm } from './use-edit-tenant-form';

const RECORD_LOADING: TenantRecordState = { status: 'loading' };

/**
 * `/settings/tenant-management/edit` (Figma 2097-123264): the identity card over the two editable
 * fields, rendered from the first paint and locked until the record seeds them. Compiled: it only
 * passes `form.control` down and never reads form state in render.
 */
export function EditTenantView({ id }: { id: string }) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const [record, setRecord] = useState<TenantRecordState>(RECORD_LOADING);
  const ready = record.status === 'ready';
  const { form, isSubmitting, handleSave } = useEditTenantForm(id, ready ? record.values : null);

  const actions: PageActionButton[] = [
    {
      label: 'Save Integration',
      variant: 'accent',
      onClick: handleSave,
      disabled: !ready || isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <PageLayout
      title="Edit Tenant Integration"
      backButton={{ label: 'Back to Integrations', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <Suspense fallback={<TenantSummaryCardSkeleton identityOnly />}>
        <TenantRecordLoader id={id} onResolved={setRecord} />
      </Suspense>
      {/* Locked fields announce nothing on their own; the text switches, the live region stays mounted. */}
      <span role="status" className="sr-only">
        {record.status === 'loading' ? 'Loading tenant…' : ''}
      </span>
      {record.status === 'missing' ? (
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />
      ) : (
        <TenantFormFields
          control={form.control}
          disabled={!ready || isSubmitting}
          hideDomain
          includeOrganization={ready ? record.organization : null}
          customersEnabled={ready}
        />
      )}
    </PageLayout>
  );
}
