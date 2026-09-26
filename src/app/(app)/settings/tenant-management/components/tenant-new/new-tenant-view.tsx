'use client';
'use no memo';

import {
  Button,
  NotFoundError,
  type PageActionButton,
  PageLayout,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { useFormState } from 'react-hook-form';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import type { DirectoryProvider } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { ConsentBlock } from '../consent/consent-block';
import { ProviderField } from '../tenant-form/provider-field';
import { TenantFormFields } from '../tenant-form/tenant-form-fields';
import { type NewTenantHandoff, NewTenantResume, type NewTenantResumeState } from './use-new-tenant-flow';
import { useNewTenantForm } from './use-new-tenant-form';

const RESUME_LOADING: NewTenantResumeState = { status: 'loading' };

interface NewTenantViewProps {
  /** `?id=`: a record this flow created before a reload or Back — the page resumes at its link step. */
  resumeId: string | null;
  /** The record the previous mount just generated for this id: resume from it, with no read. */
  handoff: NewTenantHandoff | null;
  onCreated: (handoff: NewTenantHandoff) => void;
}

/**
 * `/settings/tenant-management/new` (Figma 2097-122192 → 2097-122274): the provider picker and the
 * three fields, "Generate Connection Link" while filling, the consent card once a link stands, Save
 * in the title bar throughout — enabled only from the link phase on.
 */
export function NewTenantView({ resumeId, handoff, onCreated }: NewTenantViewProps) {
  const router = useRouter();
  const handleBack = useSafeBack(routes.settings.tenantManagement);
  const { form, flow, generateLink, handleSave } = useNewTenantForm(handoff, onCreated);
  // The frames draw Generate disabled until the form is complete; `mode: 'onChange'` keeps this live.
  const { isValid } = useFormState({ control: form.control });
  // The providers this deployment offers; unknown until the picker's query answers.
  const [offered, setOffered] = useState<readonly DirectoryProvider[] | null>(null);
  const { connection, providerLocked, resume } = flow;
  const { getValues, setValue } = form;
  const [resumeState, setResumeState] = useState<NewTenantResumeState>(RESUME_LOADING);
  // The page is keyed by `?id=`, so a mount with an id and no record yet reads it back.
  const resuming = resumeId !== null && !connection;
  const resumed = resumeState.status === 'ready' ? resumeState : null;
  useSeedForm(form, resumed ? resumed.values : null);

  // Before the paint, so a cached record never shows the fill-in step for a frame.
  useLayoutEffect(() => {
    if (resumed) resume(resumed.connection);
  }, [resumed, resume]);

  // A deployment may offer one provider only; the preselected Microsoft must follow what it offers.
  useEffect(() => {
    if (!offered || providerLocked || offered.includes(getValues('provider'))) return;
    const first = offered[0];
    if (first) setValue('provider', first, { shouldValidate: true });
  }, [offered, providerLocked, getValues, setValue]);

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
    >
      {resuming && resumeId && (
        <Suspense fallback={null}>
          <NewTenantResume id={resumeId} onResolved={setResumeState} />
        </Suspense>
      )}
      {resuming && (
        <span role="status" className="sr-only">
          {resumeState.status === 'loading' ? 'Loading tenant…' : ''}
        </span>
      )}
      {resuming && resumeState.status === 'missing' ? (
        <NotFoundError message="Tenant not found" onHome={() => router.replace(routes.settings.tenantManagement)} />
      ) : (
        <>
          <TenantFormFields
            control={form.control}
            disabled={flow.fieldsDisabled || resuming}
            domainLocked={flow.domainLocked}
            providerField={
              <ProviderField
                control={form.control}
                disabled={flow.fieldsDisabled}
                locked={providerLocked || resuming}
                onOffered={setOffered}
              />
            }
            includeOrganization={flow.boundOrganization}
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
                // No provider on offer (or not known yet) leaves nothing a Generate could create.
                disabled={resuming || !isValid || !flow.canGenerate || !offered || offered.length === 0}
                loading={flow.isGenerating}
                className="w-full md:w-auto"
              >
                Generate Connection Link
              </Button>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
