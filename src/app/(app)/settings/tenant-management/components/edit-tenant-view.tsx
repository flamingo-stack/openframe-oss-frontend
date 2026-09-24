'use client';
'use no memo';
// Holds the live react-hook-form handle from `useEditTenantForm` — the case the lint rule
// enforces this directive for, except that the rule matches imports and cannot see a hook's.

import {
  LoadError,
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { loadErrorProps, queryState } from '@/lib/query-state';
import { routes } from '@/lib/routes';
import { useEditTenantForm } from '../hooks/use-edit-tenant-form';
import { useTenantConnection } from '../hooks/use-tenant-connections';
import { TenantFormFields } from './tenant-form-fields';
import { TenantSummaryCard, TenantSummaryCardSkeleton } from './tenant-summary-card';

const LOAD_ERROR_MESSAGE = "Couldn't load this tenant.";

interface EditTenantViewProps {
  id: string;
}

/**
 * `/settings/tenant-management/edit` (Figma 2097-123264): the identity card
 * (provider · domain, neither editable) over the two fields that are. The real
 * form renders from the first paint, disabled until the record seeds it.
 */
export function EditTenantView({ id }: EditTenantViewProps) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const query = useTenantConnection(id);
  const { isLoading, isOffline, error, canClaimEmpty } = queryState(query);
  const connection = query.data ?? null;
  const { form, isSubmitting, handleSave } = useEditTenantForm(connection);

  if (error || isOffline) {
    return <LoadError {...loadErrorProps(isOffline, LOAD_ERROR_MESSAGE, () => void query.refetch())} />;
  }
  if (!isLoading && canClaimEmpty && !connection) {
    return <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />;
  }

  const ready = connection !== null;
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
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {connection ? (
        <TenantSummaryCard connection={connection} identityOnly />
      ) : (
        <TenantSummaryCardSkeleton identityOnly />
      )}
      <TenantFormFields
        control={form.control}
        disabled={!ready || isSubmitting}
        hideProvider
        hideDomain
        includeOrganization={connection?.organization}
        customersEnabled={ready}
      />
    </PageLayout>
  );
}
