'use client';
'use no memo';
// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-new/connect-tenant-form.tsx, rendered while tenant-management-v2 is off. Deleted with the flag.

import { Button, type PageActionButton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { type Control, useForm, useFormState } from 'react-hook-form';
import { SectionLoadError } from '@/app/components/shared';
import { ConsentBlock } from '../../consent/consent-block';
import { MINT_FAILED } from '../../consent/use-start-consent';
import { GENERATE_LINK_LABEL, SAVE_PLACEHOLDER, TenantFormFrame } from '../../shared/tenant-form-frame';
import { ProviderFieldV1 } from '../tenant-form/provider-field-v1';
import { TenantFormFieldsV1 } from '../tenant-form/tenant-form-fields-v1';
import type { TenantFormRecordV1 } from '../tenant-form/tenant-form-helpers-v1';
import { TENANT_FORM_DEFAULT_VALUES_V1, type TenantFormDataV1 } from '../tenant-form/tenant-form-v1.types';
import { useConnectTenantFormV1 } from './use-connect-tenant-form-v1';

/**
 * The connect step (Figma 2097-122222 → 122274): the same form as the create step with provider
 * and domain locked, the consent card in place of the Generate button, Save live in the title bar.
 * Edit Domain brings the Generate button back until a fresh link stands. With no record yet (a loading scope) it
 * draws its own loading state.
 */
export function ConnectTenantFormV1({ record }: { record: TenantFormRecordV1 | null }) {
  if (useLoadingScope() || !record) {
    return <PendingConnectTenantForm />;
  }
  return <LoadedConnectTenantForm record={record} />;
}

function LoadedConnectTenantForm({ record }: { record: TenantFormRecordV1 }) {
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
  } = useConnectTenantFormV1(record);
  const { isValid } = useFormState({ control: form.control });
  const busy = isGenerating || isSaving;

  const actions: PageActionButton[] = [
    {
      ...SAVE_PLACEHOLDER,
      onClick: handleSave,
      disabled: editingDomain || busy || isMinting || check.isChecking,
      loading: isSaving,
    },
  ];

  return (
    <ConnectTenantFormView
      control={form.control}
      actions={actions}
      busy={busy}
      editingDomain={editingDomain}
      includeOrganization={record.organization}
    >
      {editingDomain ? (
        <div>
          <Button
            variant="accent"
            onClick={generateLink}
            disabled={!isValid}
            loading={isGenerating}
            className="w-full content-md:w-auto"
          >
            {GENERATE_LINK_LABEL}
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
    </ConnectTenantFormView>
  );
}

/** The connect form's frame and fields, the same markup before and after the record is read. */
function ConnectTenantFormView({
  control,
  actions,
  busy,
  editingDomain,
  includeOrganization,
  customersEnabled,
  children,
}: {
  control: Control<TenantFormDataV1>;
  actions: PageActionButton[];
  busy: boolean;
  editingDomain: boolean;
  includeOrganization?: TenantFormRecordV1['organization'];
  customersEnabled?: boolean;
  children: ReactNode;
}) {
  return (
    <TenantFormFrame title="New Tenant Integration" actions={actions}>
      <TenantFormFieldsV1
        control={control}
        disabled={busy}
        domainLocked={!editingDomain}
        providerField={<ProviderFieldV1 control={control} disabled={busy} locked />}
        includeOrganization={includeOrganization}
        customersEnabled={customersEnabled}
      />
      {children}
    </TenantFormFrame>
  );
}

/**
 * The connect step before the record is known: the same view, locked, over a throwaway form. Only what names the
 * record (the consent instruction) is a bar, drawn by the consent block and the provider picker themselves.
 */
function PendingConnectTenantForm() {
  const form = useForm<TenantFormDataV1>({ defaultValues: TENANT_FORM_DEFAULT_VALUES_V1 });
  return (
    <ConnectTenantFormView
      control={form.control}
      actions={[{ ...SAVE_PLACEHOLDER, disabled: true }]}
      busy
      editingDomain={false}
      customersEnabled={false}
    >
      {/* Before the record the block draws its own loading state; it reads only the mode. */}
      <ConsentBlock mode="new" provider={null} />
    </ConnectTenantFormView>
  );
}
