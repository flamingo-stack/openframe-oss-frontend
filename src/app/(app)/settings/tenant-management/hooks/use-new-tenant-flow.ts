'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import type { TenantConnectionRecord } from '../types/tenant-connection';
import type { TenantFormData } from '../types/tenant-form.types';
import { useCreateTenantConnection, useStartTenantConsent, useUpdateTenantConnection } from './use-tenant-connections';
import { useTenantConsent } from './use-tenant-consent';

export type NewTenantPhase = 'filling' | 'generating' | 'link';

/**
 * The New Tenant Integration page as a state machine (Figma 2097-122192 →
 * 2097-122274), kept free of react-hook-form so it can be driven with plain
 * values:
 *
 *   filling ──generate(valid)──▶ generating ──ok──▶ link
 *   link ──editDomain──▶ filling            (link void, consent forgotten)
 *   link ──consent.check──▶ checking ──▶ connected | failed   (retry allowed)
 *   link ──save──▶ details page
 *
 * The backend creates the record on the first Generate (`createDirectoryConnection`
 * returns the connection with its consent link), so from then on the page is
 * editing an existing connection: a second Generate after Edit Domain is an
 * update plus a fresh link, and Save only writes what changed since then. The
 * provider is locked once the record exists; the domain whenever a link stands for it.
 */
export function useNewTenantFlow() {
  const { toast } = useToast();
  const router = useRouter();
  const create = useCreateTenantConnection();
  const update = useUpdateTenantConnection();
  const startConsent = useStartTenantConsent();

  const [phase, setPhase] = useState<NewTenantPhase>('filling');
  const [connection, setConnection] = useState<TenantConnectionRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous re-entry guard: two calls in one tick share the same `phase`
  // closure, so state alone cannot tell the second one to stand down. A second
  // caller gets the promise already running instead of a second write.
  const inFlightRef = useRef<Promise<void> | null>(null);
  const consent = useTenantConsent(connection?.id);

  const { mutateAsync: createAsync } = create;
  const { mutateAsync: updateAsync } = update;
  const { mutateAsync: startConsentAsync } = startConsent;
  const { reset: resetConsent, isChecking, status: consentStatus } = consent;
  const connected = consentStatus === 'connected';

  const generate = useCallback(
    (values: TenantFormData): Promise<void> => {
      // A click from the link phase (the button is gone there) is a no-op; a
      // second click while the first is in flight joins it rather than
      // creating a second record.
      if (phase !== 'filling') return Promise.resolve();
      if (inFlightRef.current) return inFlightRef.current;
      const run = async () => {
        setPhase('generating');
        try {
          let next: TenantConnectionRecord;
          if (connection) {
            // Edit Domain re-run: an unchanged domain is left out — the API refuses it once the
            // admin has consented, which may have happened outside this page.
            const domain = values.domain !== connection.domain ? values.domain : undefined;
            await updateAsync({
              id: connection.id,
              input: { domain, name: values.name, organizationId: values.organizationId },
            });
            next = await startConsentAsync(connection.id);
          } else {
            const created = await createAsync({
              provider: values.provider,
              domain: values.domain,
              name: values.name,
              organizationId: values.organizationId,
            });
            // Created but the link failed to mint (documented): retry once, and never lose the
            // record to that retry's error, or the next Generate would create a second one.
            next = created.consentUrl ? created : await startConsentAsync(created.id).catch(() => created);
          }
          resetConsent();
          setConnection(next);
          setPhase('link');
          if (!next.consentUrl) {
            toast({
              title: 'No consent link yet',
              description:
                'The integration is saved, but no consent link was issued. Use Edit Domain and generate again.',
              variant: 'warning',
            });
          }
        } catch (error) {
          toast({
            title: 'Could not generate the link',
            description: getErrorMessage(error) || 'Try again in a moment.',
            variant: 'destructive',
          });
          // Back to the form with everything the user typed still in place.
          setPhase('filling');
        }
      };
      const promise = run().finally(() => {
        inFlightRef.current = null;
      });
      inFlightRef.current = promise;
      return promise;
    },
    [phase, connection, updateAsync, startConsentAsync, createAsync, resetConsent, toast],
  );

  const editDomain = useCallback(() => {
    if (phase !== 'link') return;
    resetConsent();
    setPhase('filling');
  }, [phase, resetConsent]);

  const save = useCallback(
    (values: TenantFormData): Promise<void> => {
      if (phase !== 'link' || !connection || isChecking || isSaving) return Promise.resolve();
      if (inFlightRef.current) return inFlightRef.current;
      const run = async () => {
        setIsSaving(true);
        try {
          const changed = values.name !== connection.name || values.organizationId !== connection.organizationId;
          if (changed) {
            const next = await updateAsync({
              id: connection.id,
              input: { name: values.name, organizationId: values.organizationId },
            });
            setConnection(next);
          }
          // Saving does not connect anything: the record exists since Generate,
          // and only a successful probe means the admin has consented. Say so,
          // or "is ready" reads as "is connected" on a tenant the details page
          // is about to show as DISCONNECTED.
          toast({
            title: 'Integration saved',
            description: connected
              ? `${values.name} is connected and readable.`
              : `${values.name} stays disconnected until the customer's admin grants consent — check the connection from its page.`,
            variant: 'success',
          });
          router.replace(routes.settings.tenantDetails(connection.id));
        } catch (error) {
          toast({
            title: 'Could not save the integration',
            description: getErrorMessage(error) || 'Try again in a moment.',
            variant: 'destructive',
          });
          setIsSaving(false);
        }
      };
      const promise = run().finally(() => {
        inFlightRef.current = null;
      });
      inFlightRef.current = promise;
      return promise;
    },
    [phase, connection, isChecking, isSaving, connected, updateAsync, toast, router],
  );

  const isGenerating = phase === 'generating';

  return {
    phase,
    connection,
    consent,
    generate,
    save,
    // Once the directory has accepted the consent the domain is what it granted
    // for — the backend refuses to move it — so the action is gone, not disabled.
    editDomain: connected ? undefined : editDomain,
    isGenerating,
    isSaving,
    providerLocked: connection !== null,
    domainLocked: phase !== 'filling',
    fieldsDisabled: isGenerating || isSaving,
    canGenerate: phase === 'filling',
    canSave: phase === 'link' && !isChecking && !isSaving,
  };
}
