// What the New, Connect, Edit and Reconnect forms share: the record as they read it (one selection,
// spread by every query and mutation that hands a connection to a form), the record → form
// mapping, the changed-fields diff, the customer picker's options and the invalid-submit feedback
// (toast, then scroll — Controllers pass no `ref`).

import type { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import { graphql, readInlineData } from 'react-relay';
import type {
  tenantFormHelpers_connection$data,
  tenantFormHelpers_connection$key,
} from '@/__generated__/tenantFormHelpers_connection.graphql';
import { DirectoryProvider } from '@/generated/schema-enums';
import { collectFormErrorMessages } from '@/lib/collect-form-error-messages';
import { knownValue } from '@/lib/exhaustive-map';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';
import { readAttribution, type StoredAttribution } from './attribution-helpers';
import { toCustomerOption } from './customer-option';
import type { TenantFormData } from './tenant-form.types';

type Toast = ReturnType<typeof useToast>['toast'];

// The connection as a form sees it. `@inline` so the create mutation can select it too: its
// response then holds everything the connect step renders, and that step reads the store instead
// of fetching the record it just created. `connectedAt` is the stored "has ever consented" — the
// domain is editable only before it, and a null `consentUrl` after it means consumed, not missing.
const tenantFormHelpersFragment = graphql`
  fragment tenantFormHelpers_connection on DirectoryConnection @inline {
    id
    provider
    domain
    name
    consentUrl
    connectedAt
    customers {
      organizationId
      organization {
        status
        ...customerOption_organization
      }
      rules {
        kind
        values {
          id
          name
        }
      }
    }
  }
`;

export type StoredConnectionFields = Pick<tenantFormHelpers_connection$data, 'provider' | 'domain' | 'name'>;

/** The record as form values; provider and domain are display-only on Edit, so a value this build cannot send stays harmless. */
export function connectionToFormValues(connection: StoredConnectionFields): TenantFormData {
  return {
    provider: knownValue(DirectoryProvider, connection.provider) ?? DirectoryProvider.MICROSOFT_365,
    domain: connection.domain ?? '',
    name: connection.name,
  };
}

export interface TenantFormRecord {
  id: string;
  provider: string;
  /** `null` = no link outstanding: never minted, expired, or consumed by a successful consent. */
  consentUrl: string | null;
  /** Consent has completed at least once — the domain is fixed, and no link is expected. */
  connected: boolean;
  values: TenantFormData;
  /** The customers it serves, as the attribution form holds them. */
  attribution: StoredAttribution;
}

/** Reads the shared selection into what a form needs — plain values, so the form owns no fragment. */
export function readTenantFormRecord(ref: tenantFormHelpers_connection$key): TenantFormRecord {
  const { id, provider, domain, name, consentUrl, connectedAt, customers } = readInlineData(
    tenantFormHelpersFragment,
    ref,
  );
  return {
    id,
    provider,
    consentUrl: consentUrl ?? null,
    connected: connectedAt != null,
    values: connectionToFormValues({ provider, domain, name }),
    attribution: readAttribution(
      customers.map(({ organizationId, organization, rules }) => ({
        organizationId,
        organization: organization ? { ...toCustomerOption(organization), status: organization.status } : null,
        rules: rules.map(({ kind, values }) => ({ kind, values })),
      })),
    ),
  };
}

export type EditableField = 'name' | 'domain';

/** The fields whose value differs from what is stored — the only ones an update sends. */
export function changedFields(
  values: TenantFormData,
  stored: Readonly<Record<EditableField, string | null | undefined>>,
  fields: readonly EditableField[],
): Partial<Pick<TenantFormData, EditableField>> {
  const changes: Partial<Pick<TenantFormData, EditableField>> = {};
  for (const field of fields) {
    if (values[field] !== stored[field]) changes[field] = values[field];
  }
  return changes;
}

/** A picker's options: its stored customer is put back first while the list has not paged to it yet. */
export function withBoundOrganization<T extends { readonly organizationId: string }>(
  organizations: readonly T[],
  bound: T | null | undefined,
): readonly T[] {
  if (!bound || organizations.some(organization => organization.organizationId === bound.organizationId)) {
    return organizations;
  }
  return [bound, ...organizations];
}

/** The `handleSubmit` error branch: one destructive toast, then the page scrolls to the culprit. */
export function invalidSubmitHandler<T extends FieldValues>(toast: Toast, title: string) {
  return (errors: FieldErrors<T>) => {
    // Every rule of every customer can miss the same kind: each message once.
    const messages = [...new Set(collectFormErrorMessages(errors))];
    toast({
      title,
      description: messages.length > 0 ? messages.join(', ') : 'Please fill in all required fields.',
      variant: 'destructive',
    });
    scrollToFirstInvalidField();
  };
}
