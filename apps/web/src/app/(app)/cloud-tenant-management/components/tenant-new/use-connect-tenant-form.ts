'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { routes } from '@/lib/routes';
import { isReadable } from '../../utils/tenant-presentation';
import { useCheckConnection } from '../consent/use-check-connection';
import { useStartConsent } from '../consent/use-start-consent';
import { changedFields, type EditableField, type TenantFormRecord } from '../tenant-form/tenant-form-helpers';
import { type TenantFormData, tenantFormSchema } from '../tenant-form/tenant-form.types';
import { useAttributionForm } from '../tenant-form/use-attribution-form';
import { integrationInput, useSaveIntegration, useSubmitWithAttribution } from '../tenant-form/use-save-integration';

const SAVE_FIELDS: readonly EditableField[] = ['name'];
const GENERATE_FIELDS: readonly EditableField[] = ['name', 'domain'];

/**
 * The connect step's forms (Figma 3562-27595 → 27507), over a record the store already holds. Save writes a
 * changed name and, once the directory is readable, its customers, then leaves for the details page. Edit Domain
 * unlocks the domain; the Generate that follows writes what changed and mints a fresh link — the old one is void
 * once the tenant segment of its URL changes.
 */
export function useConnectTenantForm(record: TenantFormRecord) {
  const { toast } = useToast();
  const router = useRouter();
  const { save, isSaving } = useSaveIntegration(record.id);
  // Generate's own write, so Save does not spin while the domain is written ahead of a fresh link.
  const generateWrite = useSaveIntegration(record.id, 'Could not generate the link');
  const submit = useSubmitWithAttribution();
  // A created record with no link (the provider was unreachable at creation) gets one here.
  const consent = useStartConsent(record.id, { autoMintWhen: !record.consentUrl && !record.connected });
  const check = useCheckConnection(record.id);
  const [editingDomain, setEditingDomain] = useState(false);

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: record.values,
    mode: 'onChange',
  });
  const attribution = useAttributionForm(record.attribution.values);

  const connected = record.connected || (check.verdict?.kind === 'answered' && isReadable(check.verdict.access.state));

  const generateLink = () =>
    submit(form, null, 'Cannot generate the link yet', values => {
      // An unchanged domain is left out: the API refuses it once the admin has consented.
      generateWrite.save(changedFields(values, record.values, GENERATE_FIELDS), {
        onSaved: () =>
          consent.mint(() => {
            check.reset();
            setEditingDomain(false);
          }),
      });
    });

  // Before consent the customers block is locked: there is nothing in it to check or send.
  const handleSave = () =>
    submit(form, connected ? attribution.form : null, 'Cannot save yet', (values, attributionValues) => {
      save(
        integrationInput(
          changedFields(values, record.values, SAVE_FIELDS),
          attributionValues,
          record.attribution.values,
        ),
        {
          placeUserErrors: attribution.placeUserErrors,
          onSaved: () => {
            // Saving connects nothing: only a readable probe means the admin has consented.
            toast({
              title: 'Integration saved',
              description: connected
                ? `${values.name} is connected and readable.`
                : `${values.name} stays disconnected until the customer's admin grants consent — check the connection from its page.`,
              variant: 'success',
            });
            router.replace(routes.cloudTenantManagement.details(record.id));
          },
        },
      );
    });

  const editDomain = () => {
    check.reset();
    setEditingDomain(true);
  };

  return {
    form,
    attributionForm: attribution.form,
    connected,
    editingDomain,
    // Once the directory accepted the consent the domain is what it granted for, so the action is gone.
    editDomain: connected ? undefined : editDomain,
    generateLink,
    handleSave,
    isGenerating: editingDomain && (generateWrite.isSaving || consent.isMinting),
    isSaving,
    isMinting: consent.isMinting,
    mintFailed: consent.mintFailed,
    retryMint: () => consent.mint(),
    check,
  };
}
