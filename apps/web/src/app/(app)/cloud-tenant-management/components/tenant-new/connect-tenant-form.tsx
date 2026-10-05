'use client';
'use no memo';

import { Button, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useFormState } from 'react-hook-form';
import { SectionLoadError } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ConsentBlock } from '../consent/consent-block';
import { MINT_FAILED } from '../consent/use-start-consent';
import { ProviderField } from '../tenant-form/provider-field';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import type { TenantFormRecord } from '../tenant-form/tenant-form-helpers';
import { useConnectTenantForm } from './use-connect-tenant-form';

/**
 * The connect step (Figma 2097-122222 → 122274): the same form as the create step with provider
 * and domain locked, the consent card in place of the Generate button, Save live in the title bar.
 * Edit Domain brings the Generate button back until a fresh link stands.
 */
export function ConnectTenantForm({ record }: { record: TenantFormRecord }) {
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
            className="w-full md:w-auto"
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
