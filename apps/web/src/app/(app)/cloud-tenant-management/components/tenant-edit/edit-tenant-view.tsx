'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  NotFoundError,
  type PageActionButton,
  LoadingWhen,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { routes } from '@/lib/routes';
import { SAVE_PLACEHOLDER, TenantFormFrame } from '../shared/tenant-form-frame';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import { TenantRecordLoader, type TenantRecordState } from './tenant-record-loader';
import { useEditTenantForm } from './use-edit-tenant-form';

const RECORD_LOADING: TenantRecordState = { status: 'loading' };

/**
 * `/cloud-tenant-management/edit` (Figma 2097-123264): the identity card over the two editable
 * fields, rendered from the first paint and locked until the record seeds them. Compiled: it only
 * passes `form.control` down and never reads form state in render.
 */
export function EditTenantView({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<TenantRecordState>(RECORD_LOADING);
  const ready = record.status === 'ready';
  const { form, isSubmitting, handleSave } = useEditTenantForm(id, ready ? record.values : null);

  const actions: PageActionButton[] = [
    {
      ...SAVE_PLACEHOLDER,
      onClick: handleSave,
      disabled: !ready || isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <TenantFormFrame title="Edit Tenant Integration" actions={actions}>
      <LoadingSuspense label="Loading tenant">
        <TenantRecordLoader id={id} onResolved={setRecord} />
      </LoadingSuspense>
      {record.status === 'missing' ? (
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
      ) : (
        // Until the record has seeded them the fields are locked and the customer list draws its own loading state.
        <LoadingWhen loading={record.status === 'loading'}>
          <TenantFormFields
            control={form.control}
            disabled={!ready || isSubmitting}
            hideDomain
            includeOrganization={ready ? record.organization : null}
            customersEnabled={ready}
          />
        </LoadingWhen>
      )}
    </TenantFormFrame>
  );
}
