'use client';
'use no memo';

import {
  Button,
  type PageActionButton,
  PageLayout,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useForm, useFormState } from 'react-hook-form';
import { SectionLoadError } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ConsentBlock } from '../consent/consent-block';
import { MINT_FAILED } from '../consent/use-start-consent';
import { ProviderField } from '../tenant-form/provider-field';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import type { TenantFormRecord } from '../tenant-form/tenant-form-helpers';
import { TENANT_FORM_DEFAULT_VALUES, type TenantFormData } from '../tenant-form/tenant-form.types';
import { useConnectTenantForm } from './use-connect-tenant-form';

/**
 * The connect step (Figma 2097-122222 → 122274): the same form as the create step with provider
 * and domain locked, the consent card in place of the Generate button, Save live in the title bar.
 * Edit Domain brings the Generate button back until a fresh link stands. With no record yet (a loading scope) it
 * draws its own loading state.
 */
export function ConnectTenantForm({ record }: { record: TenantFormRecord | null }) {
  if (useLoadingScope() || !record) {
    return <ConnectTenantFormSkeleton />;
  }
  return <LoadedConnectTenantForm record={record} />;
}

function LoadedConnectTenantForm({ record }: { record: TenantFormRecord }) {
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  const {
    form,
    editingDomain,
    editDomain,
    generateLink,
    handleSave,
    isGenerating,
    isSaving,
    isMinting,
    mintFailed,
    retryMint,
    check,
  } = useConnectTenantForm(record);
  const { isValid } = useFormState({ control: form.control });
  const busy = isGenerating || isSaving;

  const actions: PageActionButton[] = [
    {
      label: 'Save Integration',
      variant: 'accent',
      onClick: handleSave,
      disabled: editingDomain || busy || isMinting || check.isChecking,
      loading: isSaving,
    },
  ];

  return (
    <PageLayout
      title="New Tenant Integration"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <TenantFormFields
        control={form.control}
        disabled={busy}
        domainLocked={!editingDomain}
        providerField={<ProviderField control={form.control} disabled={busy} locked />}
        includeOrganization={record.organization}
      />
      {editingDomain ? (
        <div>
          <Button
            variant="accent"
            onClick={generateLink}
            disabled={!isValid}
            loading={isGenerating}
            className="w-full content-md:w-auto"
          >
            Generate Connection Link
          </Button>
        </div>
      ) : (
        <>
          {mintFailed && !isMinting && !record.consentUrl && (
            <SectionLoadError message={`${MINT_FAILED}.`} onRetry={retryMint} />
          )}
          <ConsentBlock
            mode="new"
            provider={record.provider}
            consentUrl={record.consentUrl}
            checking={check.isChecking}
            verdict={check.verdict}
            onCheck={check.check}
            onEditDomain={editDomain}
            disabled={busy || isMinting}
          />
        </>
      )}
    </PageLayout>
  );
}

const SAVE_PLACEHOLDER: PageActionButton = { label: 'Save Integration', variant: 'accent', disabled: true };
const noop = () => {};

/**
 * The connect step before the record is known: the real chrome and the real controls, locked, over a throwaway
 * form, so there is no second copy of the markup. Only what names the record (the consent instruction) is a bar,
 * drawn by the consent block and the provider picker themselves.
 */
function ConnectTenantFormSkeleton() {
  const form = useForm<TenantFormData>({ defaultValues: TENANT_FORM_DEFAULT_VALUES });
  // Live, not a stub: Back works while the record loads.
  const handleBack = useSafeBack(routes.cloudTenantManagement.list);
  return (
    <PageLayout
      title="New Tenant Integration"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={[SAVE_PLACEHOLDER]}
      actionsVariant="primary-buttons"
    >
      <TenantFormFields
        control={form.control}
        disabled
        domainLocked
        providerField={<ProviderField control={form.control} disabled locked />}
        customersEnabled={false}
      />
      {/* Before the record the block draws its own loading state; it reads only the mode. */}
      <ConsentBlock mode="new" provider="" consentUrl={null} checking={false} verdict={null} onCheck={noop} />
    </PageLayout>
  );
}
