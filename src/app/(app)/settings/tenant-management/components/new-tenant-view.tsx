'use client';
'use no memo';

import { Button, type PageActionButton, PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useFormState } from 'react-hook-form';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { useNewTenantForm } from '../hooks/use-new-tenant-form';
import { useTenantConnectionOptions } from '../hooks/use-tenant-connections';
import { ConsentBlock } from './consent/consent-block';
import { TenantFormFields } from './tenant-form-fields';

/**
 * `/settings/tenant-management/new` (Figma 2097-122192 → 2097-122274): the
 * provider picker and the three fields, "Generate Connection Link" while the
 * form is being filled, the consent card in its place once a link stands, Save
 * in the title bar throughout — enabled only from the link phase on. Copy is
 * the frames' own, "Back to Integrations" included.
 */
export function NewTenantView() {
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const { form, flow, generateLink, handleSave } = useNewTenantForm();
  // The frames draw Generate disabled until the form is complete (2097-122192
  // vs 2097-122207); `mode: 'onChange'` keeps this live.
  const { isValid } = useFormState({ control: form.control });
  const { connection } = flow;
  // Which providers this deployment has enabled; the full set until it answers.
  const options = useTenantConnectionOptions();

  const actions: PageActionButton[] = [
    {
      label: 'Save Integration',
      variant: 'accent',
      onClick: handleSave,
      disabled: !flow.canSave,
      loading: flow.isSaving,
    },
  ];

  return (
    <PageLayout
      title="New Tenant Integration"
      backButton={{ label: 'Back to Integrations', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      <TenantFormFields
        control={form.control}
        disabled={flow.fieldsDisabled}
        providerLocked={flow.providerLocked}
        domainLocked={flow.domainLocked}
        // Once the record exists its customer is bound, and the backend list of
        // available customers no longer offers it — ask for it back or the
        // picker goes blank under the user.
        includeOrganizationId={connection?.organizationId}
        providers={options.data?.providers}
      />
      {flow.phase === 'link' && connection ? (
        <ConsentBlock
          mode="new"
          provider={connection.provider}
          consentUrl={connection.consentUrl}
          checkState={flow.consent.status}
          checkResult={flow.consent.result}
          checkError={flow.consent.error}
          onCheck={flow.consent.check}
          onEditDomain={flow.editDomain}
          disabled={flow.isSaving}
        />
      ) : (
        <div>
          <Button
            variant="accent"
            onClick={generateLink}
            disabled={!isValid || !flow.canGenerate}
            loading={flow.isGenerating}
            className="w-full md:w-auto"
          >
            Generate Connection Link
          </Button>
        </div>
      )}
    </PageLayout>
  );
}
