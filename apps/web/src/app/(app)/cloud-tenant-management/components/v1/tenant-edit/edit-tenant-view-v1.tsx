'use client';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-edit/edit-tenant-view.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import {
  NotFoundError,
  type PageActionButton,
  LoadingWhen,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { routes } from '@/lib/routes';
import { SAVE_PLACEHOLDER, TenantFormFrame } from '../../shared/tenant-form-frame';
import { TenantFormFieldsV1 } from '../tenant-form/tenant-form-fields-v1';
import { TenantRecordLoaderV1, type TenantRecordStateV1 } from './tenant-record-loader-v1';
import { useEditTenantFormV1 } from './use-edit-tenant-form-v1';

const RECORD_LOADING: TenantRecordStateV1 = { status: 'loading' };

/**
 * `/cloud-tenant-management/edit` (Figma 2097-123264): the identity card over the two editable
 * fields, rendered from the first paint and locked until the record seeds them. Compiled: it only
 * passes `form.control` down and never reads form state in render.
 */
export function EditTenantViewV1({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<TenantRecordStateV1>(RECORD_LOADING);
  const ready = record.status === 'ready';
  const { form, isSubmitting, handleSave } = useEditTenantFormV1(id, ready ? record.values : null);

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
      <TenantRecordLoaderV1 id={id} onResolved={setRecord} />
      {record.status === 'missing' ? (
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.cloudTenantManagement.list)} />
      ) : (
        // Until the record has seeded them the fields are locked and the customer list draws its own loading state.
        <LoadingWhen loading={record.status === 'loading'}>
          <TenantFormFieldsV1
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
