'use client';
'use no memo';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { safeBackOrReplace } from '@/app/hooks/use-safe-back';
import { useSeedForm } from '@/app/hooks/use-seed-form';
import { collectFormErrorMessages } from '@/lib/collect-form-error-messages';
import { routes } from '@/lib/routes';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import type { CustomerAppearanceHandle } from '../components/ai-assistant-appearance/customer-ai-assistant-appearance';
import type { CustomerAiConfigurationHandle } from '../components/customer-ai-configuration/customer-ai-configuration';
import type { CustomerDeviceGuardrailsHandle } from '../components/customer-device-guardrails-settings';
import type { CustomerGuardrailsHandle } from '../components/customer-guardrails-settings';
import {
  CUSTOMER_FORM_CREATE_DEFAULTS,
  CUSTOMER_FORM_DEFAULT_VALUES,
  type CustomerFormData,
  customerFormSchema,
} from '../types/customer-form.types';
import {
  DEFAULT_PRESERVED_FIELDS,
  formToWriteInput,
  recordToForm,
  toPreservedFields,
} from '../utils/customer-form-mappers';
import { invalidateCustomerQueries } from '../utils/invalidate-customer-queries';
import { useCreateCustomer } from './use-create-customer';
import { useCustomerDetails } from './use-customer-details';
import { useUpdateCustomer } from './use-update-customer';

interface UseCustomerFormOptions {
  organizationId: string | null;
  /** Create mode: upload the logo picked before the record existed. Failure is the logo's own warning. */
  flushPendingLogo: (createdOrganizationId: string) => Promise<void>;
  /** An invalid submit — the page brings the Details panel forward when another tab is showing. */
  onInvalid?: () => void;
}

/**
 * Owns the customer form: react-hook-form + zod, the seed from the fetched
 * record, the imperative handles of the sub-panels and the whole Save chain.
 * Everything the page needs per render comes back as primitives or stable
 * functions — the page is compiled by the React Compiler and must never read
 * `form.formState` / `watch()` itself (the `form` object keeps one identity, so
 * a compiled read of it would memoise once and freeze).
 */
export function useCustomerForm({ organizationId, flushPendingLogo, onInvalid }: UseCustomerFormOptions) {
  const isEditMode = organizationId !== null;
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { createOrganization } = useCreateCustomer();
  const { updateOrganization } = useUpdateCustomer();
  // `hasData` gates Save and the fields: offline the query PAUSES, so `organization`
  // is null for a reason that has nothing to do with the record being empty.
  // Without it the edit form would render blank and Save would PUT those blanks
  // over the real customer — website, notes, addresses, contacts.
  const { organization, hasData: customerLoaded } = useCustomerDetails(organizationId);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: isEditMode ? CUSTOMER_FORM_DEFAULT_VALUES : CUSTOMER_FORM_CREATE_DEFAULTS,
    // `onChange` lets RHF own the validation lifecycle: errors surfaced by a
    // Save attempt clear themselves as soon as the field becomes valid.
    mode: 'onChange',
    // The core inputs forward a real ref, so RHF would natively focus the first
    // error and scroll the overflow:hidden app shell with it; the scroll helper
    // below owns that job.
    shouldFocusError: false,
  });

  // Seed once the record lands (layout effect, dirty-guarded). Memoised by hand:
  // this module is 'use no memo', and useSeedForm compares the seed by reference.
  const seed = useMemo(() => (organization ? recordToForm(organization) : null), [organization]);
  useSeedForm(form, seed);

  // Inline errors stay hidden on a pristine form; the first Save attempt flips
  // this and they track validation live from then on.
  const [showErrors, setShowErrors] = useState(false);
  // The real double-submit gate: `formState.isSubmitting` only disables the
  // button after a re-render, and handleSubmit has no re-entrancy guard.
  const inFlightRef = useRef(false);

  // Let "Save Customer" also persist the AI configuration / guardrails blocks.
  // Only one AI block is mounted at a time (the flag picks old vs new), so at
  // most one of these refs is set; both handle shapes are `{ validate, commit }`.
  const aiConfigurationRef = useRef<CustomerAiConfigurationHandle>(null);
  const appearanceRef = useRef<CustomerAppearanceHandle>(null);
  const guardrailsRef = useRef<CustomerGuardrailsHandle>(null);
  const deviceGuardrailsRef = useRef<CustomerDeviceGuardrailsHandle>(null);

  const onValid = useCallback(
    async (data: CustomerFormData) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      // Everything is caught here: handleSubmit re-throws a rejection after
      // resetting isSubmitting, and handleSave does not await it.
      try {
        // Whichever AI block is mounted (flag picks old appearance vs new config).
        const activeAiHandle = aiConfigurationRef.current ?? appearanceRef.current;

        // Validate the AI fields before writing anything.
        if (activeAiHandle && !(await activeAiHandle.validate())) {
          toast({
            title: 'Check AI configuration',
            description: 'Fix the highlighted AI configuration fields before saving',
            variant: 'destructive',
          });
          return;
        }

        const payload = formToWriteInput(
          data,
          organization ? toPreservedFields(organization) : DEFAULT_PRESERVED_FIELDS,
        );

        let createdOrganizationId: string | null = null;

        if (organizationId) {
          await updateOrganization(organizationId, payload);
        } else {
          const response = await createOrganization(payload);
          createdOrganizationId = response?.organizationId || response?.id || null;
        }

        // Deferred logo upload for newly-created orgs
        if (!organizationId && createdOrganizationId) {
          await flushPendingLogo(createdOrganizationId);
        }

        // Persist the AI overrides/reset (edit mode only). The customer is already
        // saved at this point, so a configuration failure is a non-fatal warning —
        // it must not surface as a full "Save failed".
        if (organizationId && activeAiHandle) {
          try {
            await activeAiHandle.commit();
          } catch (e) {
            toast({
              title: 'Customer saved, AI configuration not updated',
              description: e instanceof Error ? e.message : 'Failed to save the customer AI configuration',
              variant: 'warning',
            });
          }
        }

        // Persist the per-customer guardrails selection (edit mode only). Same
        // non-fatal semantics as the appearance block: the customer is saved.
        if (organizationId && guardrailsRef.current) {
          try {
            await guardrailsRef.current.commit();
          } catch (e) {
            toast({
              title: 'Customer saved, guardrails not updated',
              description: e instanceof Error ? e.message : 'Failed to save customer guardrails',
              variant: 'warning',
            });
          }
        }

        // Persist the per-customer remote access permission (edit mode only).
        if (organizationId && deviceGuardrailsRef.current) {
          try {
            await deviceGuardrailsRef.current.commit();
          } catch (e) {
            toast({
              title: 'Customer saved, device guardrails not updated',
              description: e instanceof Error ? e.message : 'Failed to save customer device guardrails',
              variant: 'warning',
            });
          }
        }

        await invalidateCustomerQueries(queryClient, organizationId);

        toast({
          title: organizationId ? 'Customer updated' : 'Customer created',
          description: `${data.name} has been ${organizationId ? 'updated' : 'created'}`,
        });
        if (organizationId) {
          safeBackOrReplace(router, routes.customers.details(organizationId));
        } else {
          router.replace(routes.customers.list());
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save customer';
        toast({ title: 'Save failed', description: msg, variant: 'destructive' });
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      organizationId,
      organization,
      updateOrganization,
      createOrganization,
      flushPendingLogo,
      queryClient,
      router,
      toast,
    ],
  );

  const handleSave = useCallback(() => {
    form.handleSubmit(onValid, errors => {
      setShowErrors(true);
      const messages = collectFormErrorMessages(errors);
      toast({
        title: 'Cannot save yet',
        description: messages.length > 0 ? messages.join(', ') : 'Please fill in all required fields.',
        variant: 'destructive',
      });
      onInvalid?.();
      // The offending field is usually scrolled off-screen by now — take the
      // user to it (a no-op while its panel is hidden; the page scrolls once
      // the Details tab is showing).
      scrollToFirstInvalidField();
    })();
  }, [form, onValid, onInvalid, toast]);

  return {
    form,
    organization,
    isEditMode,
    customerLoaded,
    isSubmitting: form.formState.isSubmitting,
    showErrors,
    handleSave,
    refs: { aiConfigurationRef, appearanceRef, guardrailsRef, deviceGuardrailsRef },
  };
}
