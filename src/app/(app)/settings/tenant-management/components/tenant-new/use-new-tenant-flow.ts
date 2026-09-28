'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { graphql, useFragment, useLazyLoadQuery, useMutation } from 'react-relay';
import type { useNewTenantFlow_connection$key } from '@/__generated__/useNewTenantFlow_connection.graphql';
import type { useNewTenantFlowCreateMutation as CreateMutationType } from '@/__generated__/useNewTenantFlowCreateMutation.graphql';
import type { useNewTenantFlowResumeQuery as ResumeQueryType } from '@/__generated__/useNewTenantFlowResumeQuery.graphql';
import type { useNewTenantFlowStartConsentMutation as StartConsentMutationType } from '@/__generated__/useNewTenantFlowStartConsentMutation.graphql';
import type { useNewTenantFlowUpdateMutation as UpdateMutationType } from '@/__generated__/useNewTenantFlowUpdateMutation.graphql';
import { useRetryKey } from '@/app/components/shared';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { useTenantConsent } from '../consent/use-tenant-consent';
import { useMountedRef } from '../shared/use-mounted-ref';
import { toCustomerOption } from '../tenant-form/customer-option';
import { changedFields, connectionToFormValues } from '../tenant-form/tenant-form-helpers';
import type { TenantFormData } from '../tenant-form/tenant-form.types';

// The record this page is editing once Generate created it. Every mutation below returns it, so the
// store (merged by id) always holds the latest name, customer and link.
const connectionFragment = graphql`
  fragment useNewTenantFlow_connection on DirectoryConnection {
    id
    name
    provider
    domain
    organizationId
    consentUrl
    organization {
      ...customerOption_organization
    }
  }
`;

const createMutation = graphql`
  mutation useNewTenantFlowCreateMutation($input: CreateDirectoryConnectionInput!) {
    createDirectoryConnection(input: $input) {
      connection {
        id
        consentUrl
        ...useNewTenantFlow_connection
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const updateMutation = graphql`
  mutation useNewTenantFlowUpdateMutation($connectionId: ID!, $input: UpdateDirectoryConnectionInput!) {
    updateDirectoryConnection(connectionId: $connectionId, input: $input) {
      connection {
        id
        ...useNewTenantFlow_connection
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const startConsentMutation = graphql`
  mutation useNewTenantFlowStartConsentMutation($connectionId: ID!) {
    startDirectoryConsent(connectionId: $connectionId) {
      connection {
        id
        consentUrl
        ...useNewTenantFlow_connection
      }
      userErrors {
        code
        message
      }
    }
  }
`;

// The record a New flow created, read back from `?id=` after a reload or Back.
const resumeQuery = graphql`
  query useNewTenantFlowResumeQuery($id: ID!) {
    directoryConnection(connectionId: $id) {
      name
      provider
      domain
      organizationId
      ...useNewTenantFlow_connection
    }
  }
`;

export type NewTenantPhase = 'filling' | 'generating' | 'link';

/** The record Generate just created, handed to the page's next mount so it resumes without a reload. */
export interface NewTenantHandoff {
  id: string;
  connection: useNewTenantFlow_connection$key;
  values: TenantFormData;
}

interface NewTenantFlowOptions {
  /** Start at the link step on this record (the page remounted onto the id Generate put in the URL). */
  initial?: NewTenantHandoff | null;
  /** Called once Generate has created the record, before the URL gains its id. */
  onCreated?: (handoff: NewTenantHandoff) => void;
}

/** What the New page knows about the record named in its `?id=`. */
export type NewTenantResumeState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; connection: useNewTenantFlow_connection$key; values: TenantFormData };

/** Data island (renders nothing): reads the record back; the page seeds the form and resumes from it. */
export function NewTenantResume({ id, onResolved }: { id: string; onResolved: (state: NewTenantResumeState) => void }) {
  const retryKey = useRetryKey();
  const { directoryConnection: record } = useLazyLoadQuery<ResumeQueryType>(
    resumeQuery,
    { id },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );

  // Identity matters: `useSeedForm` seeds once per values object, so it changes only with the record.
  const state = useMemo<NewTenantResumeState>(() => {
    if (!record) return { status: 'missing' };
    const { name, provider, domain, organizationId } = record;
    return {
      status: 'ready',
      connection: record,
      values: connectionToFormValues({ name, provider, domain, organizationId }),
    };
  }, [record]);

  useLayoutEffect(() => {
    onResolved(state);
  }, [state, onResolved]);

  return null;
}

/** A create / start-consent answer: the new link and a key to the whole record. */
type LinkedConnection = NonNullable<CreateMutationType['response']['createDirectoryConnection']['connection']>;

const TRY_AGAIN = 'Try again in a moment.';

/**
 * The New page as a state machine (Figma 2097-122192 → 2097-122274), free of react-hook-form:
 * filling → generating → link; Edit Domain returns to filling; Save leaves for the details page.
 * Generate creates the record once; later Generates update it and mint a fresh link.
 */
export function useNewTenantFlow({ initial = null, onCreated }: NewTenantFlowOptions = {}) {
  const { toast } = useToast();
  const router = useRouter();
  const [commitCreate] = useMutation<CreateMutationType>(createMutation);
  const [commitUpdate] = useMutation<UpdateMutationType>(updateMutation);
  const [commitStartConsent] = useMutation<StartConsentMutationType>(startConsentMutation);

  const [phase, setPhase] = useState<NewTenantPhase>(initial ? 'link' : 'filling');
  const [connectionRef, setConnectionRef] = useState<useNewTenantFlow_connection$key | null>(
    initial?.connection ?? null,
  );
  const connection = useFragment(connectionFragment, connectionRef);
  const [isSaving, setIsSaving] = useState(false);
  // Two calls in one tick share the same `phase`; the second joins the running write instead of starting one.
  const inFlightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useMountedRef();
  const consent = useTenantConsent(connection?.id);
  const connected = consent.status === 'connected';

  const create = (input: CreateMutationType['variables']['input']) =>
    new Promise<LinkedConnection>((resolve, reject) => {
      commitCreate({
        variables: { input },
        onCompleted: ({ createDirectoryConnection: { connection: created, userErrors } }) => {
          const [refusal] = userErrors;
          if (refusal || !created) reject(new Error(refusal?.message || 'Could not create the connection'));
          else resolve(created);
        },
        onError: reject,
      });
    });

  const update = (connectionId: string, input: UpdateMutationType['variables']['input']) =>
    new Promise<void>((resolve, reject) => {
      commitUpdate({
        variables: { connectionId, input },
        onCompleted: ({ updateDirectoryConnection: { userErrors } }) => {
          const [refusal] = userErrors;
          if (refusal) reject(new Error(refusal.message || 'Could not update the connection'));
          else resolve();
        },
        onError: reject,
      });
    });

  const startConsent = (connectionId: string) =>
    new Promise<LinkedConnection>((resolve, reject) => {
      commitStartConsent({
        variables: { connectionId },
        onCompleted: ({ startDirectoryConsent: { connection: minted, userErrors } }) => {
          const [refusal] = userErrors;
          if (refusal || !minted) reject(new Error(refusal?.message || 'Could not create a consent link'));
          else resolve(minted);
        },
        onError: reject,
      });
    });

  const runOnce = (run: () => Promise<void>): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    const promise = run().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = promise;
    return promise;
  };

  // Promise chains, not try/catch: a conditional inside `try` makes the React Compiler skip the hook.
  const writeAndMint = async (values: TenantFormData): Promise<LinkedConnection> => {
    if (connection) {
      // Edit Domain re-run: an unchanged domain is left out — the API refuses it once the admin has consented.
      const input = changedFields(values, connection, ['name', 'organizationId', 'domain']);
      if (Object.keys(input).length > 0) await update(connection.id, input);
      return startConsent(connection.id);
    }
    const created = await create({
      provider: values.provider,
      domain: values.domain,
      name: values.name,
      organizationId: values.organizationId,
    });
    if (created.consentUrl) return created;
    // Created without a link: retry once, and never lose the record to that retry's error.
    return startConsent(created.id).catch((error: unknown) => {
      console.warn('[tenant-management] consent link retry failed:', error);
      return created;
    });
  };

  const generate = (values: TenantFormData): Promise<void> => {
    // The button is gone in the link phase; a click from there is a no-op.
    if (phase !== 'filling') return Promise.resolve();
    return runOnce(() => {
      setPhase('generating');
      const creating = !connection;
      return writeAndMint(values).then(
        next => {
          consent.reset();
          setConnectionRef(next);
          setPhase('link');
          // The record exists from here on: put it in the address, so a reload or Back resumes it.
          if (creating && mountedRef.current) {
            onCreated?.({ id: next.id, connection: next, values });
            router.replace(routes.settings.tenantNew({ id: next.id }));
          }
          if (!next.consentUrl) {
            toast({
              title: 'No consent link yet',
              description:
                'The integration is saved, but no consent link was issued. Use Edit Domain and generate again.',
              variant: 'warning',
            });
          }
        },
        (error: unknown) => {
          toast({
            title: 'Could not generate the link',
            description: getRelayErrorMessage(error, TRY_AGAIN),
            variant: 'destructive',
          });
          // Back to the form with everything the user typed still in place.
          setPhase('filling');
        },
      );
    });
  };

  /** Continue a record this page created before a reload; a page that already holds one ignores it. */
  const resume = (ref: useNewTenantFlow_connection$key) => {
    if (connectionRef || phase !== 'filling') return;
    setConnectionRef(ref);
    setPhase('link');
  };

  const editDomain = () => {
    if (phase !== 'link') return;
    consent.reset();
    setPhase('filling');
  };

  const save = (values: TenantFormData): Promise<void> => {
    if (phase !== 'link' || !connection || consent.isChecking || isSaving) return Promise.resolve();
    const { id } = connection;
    const input = changedFields(values, connection, ['name', 'organizationId']);
    return runOnce(() => {
      setIsSaving(true);
      const written = Object.keys(input).length > 0 ? update(id, input) : Promise.resolve();
      return written.then(
        () => {
          // Saving connects nothing: only a readable probe means the admin has consented.
          toast({
            title: 'Integration saved',
            description: connected
              ? `${values.name} is connected and readable.`
              : `${values.name} stays disconnected until the customer's admin grants consent — check the connection from its page.`,
            variant: 'success',
          });
          // The update outlives the page: a user who already left is not pulled back to the details.
          if (mountedRef.current) router.replace(routes.settings.tenantDetails(id));
        },
        (error: unknown) => {
          toast({
            title: 'Could not save the integration',
            description: getRelayErrorMessage(error, TRY_AGAIN),
            variant: 'destructive',
          });
          setIsSaving(false);
        },
      );
    });
  };

  // The API lists only unbound customers; once the record exists its own customer is put back in the picker.
  const boundOrganization = connection ? toCustomerOption(connection.organization) : null;

  const isGenerating = phase === 'generating';

  return {
    phase,
    connection,
    boundOrganization,
    consent,
    generate,
    save,
    resume,
    // Once the directory accepted the consent the domain is what it granted for, so the action is gone.
    editDomain: connected ? undefined : editDomain,
    isGenerating,
    isSaving,
    providerLocked: connectionRef !== null,
    domainLocked: phase !== 'filling',
    fieldsDisabled: isGenerating || isSaving,
    canGenerate: phase === 'filling',
    canSave: phase === 'link' && !consent.isChecking && !isSaving,
  };
}
