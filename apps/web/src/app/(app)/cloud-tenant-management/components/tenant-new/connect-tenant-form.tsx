'use client';
'use no memo';

import { Button, type PageActionButton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { type Control, useForm, useFormState } from 'react-hook-form';
import { SectionLoadError } from '@/app/components/shared';
import { ConsentBlock } from '../consent/consent-block';
import { MINT_FAILED } from '../consent/use-start-consent';
import { GENERATE_LINK_LABEL, SAVE_PLACEHOLDER, TenantFormFrame } from '../shared/tenant-form-frame';
import { AttributionFields, PendingAttributionFields } from '../tenant-form/attribution-fields';
import { ProviderField } from '../tenant-form/provider-field';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import type { TenantFormRecord } from '../tenant-form/tenant-form-helpers';
import { TENANT_FORM_DEFAULT_VALUES, type TenantFormData } from '../tenant-form/tenant-form.types';
import { useConnectTenantForm } from './use-connect-tenant-form';

/**
 * The connect step (Figma 3562-27595 → 27507): the same form as the create step with provider and domain locked,
 * the consent card in place of the Generate button, then the customers — locked until the directory answers
 * readable, because their rules are built from what it holds. Save is live in the title bar. Edit Domain brings the
 * Generate button back until a fresh link stands. With no record yet (a loading scope) it draws its own loading
 * state.
 */
export function ConnectTenantForm({ record }: { record: TenantFormRecord | null }) {
  if (useLoadingScope() || !record) {
    return <PendingConnectTenantForm />;
  }
  return <LoadedConnectTenantForm record={record} />;
}

function LoadedConnectTenantForm({ record }: { record: TenantFormRecord }) {
  const {
    form,
    attributionForm,
    connected,
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
      attribution={
        <AttributionFields
          form={attributionForm}
          connectionId={record.id}
          provider={record.provider}
          readable={connected}
          locked={!connected}
          busy={busy}
          stored={record.attribution}
        />
      }
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
  attribution,
  children,
}: {
  control: Control<TenantFormData>;
  actions: PageActionButton[];
  busy: boolean;
  editingDomain: boolean;
  /** "Customers and attribution", under the consent card. */
  attribution: ReactNode;
  children: ReactNode;
}) {
  return (
    <TenantFormFrame title="New Tenant Integration" actions={actions}>
      <TenantFormFields
        control={control}
        disabled={busy}
        domainLocked={!editingDomain}
        providerField={<ProviderField control={control} disabled={busy} locked />}
      />
      {children}
      {attribution}
    </TenantFormFrame>
  );
}

/**
 * The connect step before the record is known: the same view, locked, over throwaway forms. Only what names the
 * record (the consent instruction) is a bar, drawn by the consent block and the provider picker themselves.
 */
function PendingConnectTenantForm() {
  const form = useForm<TenantFormData>({ defaultValues: TENANT_FORM_DEFAULT_VALUES });
  return (
    <ConnectTenantFormView
      control={form.control}
      actions={[{ ...SAVE_PLACEHOLDER, disabled: true }]}
      busy
      editingDomain={false}
      attribution={<PendingAttributionFields />}
    >
      {/* Before the record the block draws its own loading state; it reads only the mode. */}
      <ConsentBlock mode="new" provider={null} />
    </ConnectTenantFormView>
  );
}
