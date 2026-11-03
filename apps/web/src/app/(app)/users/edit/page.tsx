'use client';

import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { notFound } from 'next/navigation';
import { useRequiredIdParam } from '@/app/hooks/use-required-id-param';
import { routes } from '@/lib/routes';
import { TenantPageShell } from '../../cloud-tenant-management/components/shared/tenant-page-shell';
import { useTenantManagementGate } from '../../cloud-tenant-management/components/shared/use-tenant-management-gate';
import { EDIT_USER_TITLE } from '../components/user-edit/edit-user-form';
import { EditUserView } from '../components/user-edit/edit-user-view';

export default function EditUserPage() {
  const gate = useTenantManagementGate();
  // `?id=` (an account id) missing → the list. Null while redirecting.
  const id = useRequiredIdParam(routes.users.list);
  if (gate === 'off') {
    notFound();
  }
  if (!id) {
    return null;
  }
  return (
    <TenantPageShell title={EDIT_USER_TITLE} errorMessage="Couldn't load this user." resetKey={id}>
      {/* The flag may not be read as "no" before it is known: until then the view draws in a loading scope, where it
          locks its controls and fetches nothing. Keyed by id: a hop to another user would otherwise keep this one's edits. */}
      <LoadingWhen loading={gate === 'loading'}>
        <EditUserView key={id} id={id} />
      </LoadingWhen>
    </TenantPageShell>
  );
}
