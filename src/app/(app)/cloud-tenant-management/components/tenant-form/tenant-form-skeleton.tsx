'use client';
'use no memo';

import { Button, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useForm } from 'react-hook-form';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ConsentPanelSkeleton } from '../consent/consent-panel-skeleton';
import { TenantSummaryCardSkeleton } from '../tenant-detail/tenant-summary-card';
import { ProviderFieldSkeleton } from './provider-field-skeleton';
import { TenantFormFields } from './tenant-form-fields';
import { TENANT_FORM_DEFAULT_VALUES, type TenantFormData } from './tenant-form.types';

/** `new` is the create step, `connect` the same page once a record exists (`?id=`). */
type TenantFormSkeletonVariant = 'new' | 'connect' | 'edit' | 'reconnect';

const FORM_TITLES: Record<TenantFormSkeletonVariant, string> = {
  new: 'New Tenant Integration',
  connect: 'New Tenant Integration',
  edit: 'Edit Tenant Integration',
  reconnect: 'Reconnect Tenant Integration',
};

const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Integration', variant: 'accent', disabled: true };

/**
 * The New / Edit / Reconnect pages while the flag or the record is unknown: the real
 * chrome and the real controls, locked (canon `edit-schedule-skeleton`). The fields come from
 * `TenantFormFields` over a throwaway form, so there is no second copy of the markup to keep in
 * step; only what names the record — the identity card's values, the consent instruction — is a bar.
 */
export function TenantFormSkeleton({ variant }: { variant: TenantFormSkeletonVariant }) {
  const form = useForm<TenantFormData>({ defaultValues: TENANT_FORM_DEFAULT_VALUES });
  // Live, not a stub: this is also the Suspense fallback of the record fetch on `/new?id=` and Reconnect.
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  const create = variant === 'new' || variant === 'connect';

  return (
    <PageLayout
      title={FORM_TITLES[variant]}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={[SAVE_PLACEHOLDER]}
      actionsVariant="primary-buttons"
    >
      {!create && <TenantSummaryCardSkeleton identityOnly />}
      {variant !== 'reconnect' && (
        <TenantFormFields
          control={form.control}
          disabled
          domainLocked
          hideDomain={variant === 'edit'}
          providerField={create ? <ProviderFieldSkeleton /> : undefined}
          customersEnabled={false}
        />
      )}
      {variant === 'new' && (
        <div>
          <Button variant="accent" disabled className="w-full md:w-auto">
            Generate Connection Link
          </Button>
        </div>
      )}
      {variant === 'connect' && <ConsentPanelSkeleton mode="new" />}
      {variant === 'reconnect' && <ConsentPanelSkeleton mode="reconnect" />}
    </PageLayout>
  );
}
