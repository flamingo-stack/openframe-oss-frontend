'use client';

import {
  LoadingWhen,
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { EditUserFields } from './edit-user-fields';
import { EDIT_USER_TITLE } from './edit-user-form';
import { EditUserRecordLoader, type EditUserRecordState } from './edit-user-record-loader';
import { useEditUserForm } from './use-edit-user-form';

const RECORD_LOADING: EditUserRecordState = { status: 'loading' };

/**
 * `/users/edit` (Figma 1040:37391, 1104:3, 1104:87693): the form, rendered from the first paint and locked until the
 * record seeds it. Compiled: it only passes the form down and never reads form state in render.
 */
export function EditUserView({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<EditUserRecordState>(RECORD_LOADING);
  const record = state.status === 'ready' ? state.record : null;
  const { form, isSubmitting, handleSave } = useEditUserForm(record);
  const handleBack = useSafeBack(routes.users.details(id));

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    {
      label: 'Save User',
      variant: 'accent',
      onClick: handleSave,
      disabled: !record || record.customers.length === 0 || isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <PageLayout
      title={EDIT_USER_TITLE}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <EditUserRecordLoader id={id} onResolved={setState} />
      {state.status === 'missing' ? (
        <NotFoundError message="User not found" onHome={() => router.replace(routes.users.list)} />
      ) : (
        <LoadingWhen loading={state.status === 'loading'}>
          <EditUserFields form={form} record={record} disabled={isSubmitting} />
        </LoadingWhen>
      )}
    </PageLayout>
  );
}
