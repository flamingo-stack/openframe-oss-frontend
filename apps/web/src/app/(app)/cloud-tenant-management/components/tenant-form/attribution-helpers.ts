// What the forms do with a connection's customers: read them into the attribution form (one
// customer holding a single `ALL` rule is "One customer owns this tenant"), turn the form back
// into the mutation's input, tell whether it changed, and place the API's refusals on the fields
// they name.

import type { FieldPath } from 'react-hook-form';
import type { tenantFormHelpers_connection$data } from '@/__generated__/tenantFormHelpers_connection.graphql';
import type {
  DirectoryConnectionCustomerInput,
  DirectoryRuleInput,
  useSaveIntegrationMutation$data,
} from '@/__generated__/useSaveIntegrationMutation.graphql';
import { DirectoryRuleKind } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import {
  ATTRIBUTION_MODE,
  type AttributionFormData,
  type AttributionMode,
  type AttributionRule,
} from './attribution.types';
import type { CustomerOption } from './customer-option';

type RecordCustomer = tenantFormHelpers_connection$data['customers'][number];

/** A stored customer with its organization read into the picker's option; `null` when the document is gone. */
export type StoredCustomer = Omit<RecordCustomer, 'organization'> & {
  organization: (CustomerOption & { readonly status: string | null | undefined }) | null;
};

/** A customer the form shows but cannot send back: the API refuses an organization that is archived or gone. */
export interface ArchivedCustomer {
  organizationId: string;
  /** `null` when the organization document is gone. */
  name: string | null;
}

export interface StoredAttribution {
  values: AttributionFormData;
  archived: readonly ArchivedCustomer[];
  /** The stored customers' options: a picker shows its customer before its list has paged to it. */
  options: ReadonlyMap<string, CustomerOption>;
}

/** The backend's own test (`DirectoryActiveOrganizations`): a legacy organization with no status is active. */
function isActive(customer: StoredCustomer): boolean {
  const { organization } = customer;
  return organization != null && (organization.status == null || organization.status === 'ACTIVE');
}

function isWholeDirectory(rules: RecordCustomer['rules']): boolean {
  return rules.length === 1 && rules[0]?.kind === DirectoryRuleKind.ALL;
}

function toFormRule(rule: RecordCustomer['rules'][number]): AttributionRule {
  return {
    // A kind this build does not know reads as not picked: the form asks for one rather than sending it blind.
    kind: knownValue(DirectoryRuleKind, rule.kind) ?? '',
    values: rule.values.map(value => ({ id: value.id, name: value.name ?? null })),
  };
}

/** The stored customers as the form holds them, the ones it cannot send back set apart. */
export function readAttribution(customers: readonly StoredCustomer[]): StoredAttribution {
  const active = customers.filter(isActive);
  const archived = customers
    .filter(customer => !isActive(customer))
    .map(customer => ({ organizationId: customer.organizationId, name: customer.organization?.name ?? null }));
  const options = new Map<string, CustomerOption>(
    active.flatMap(({ organizationId, organization }) =>
      organization ? [[organizationId, { organizationId, name: organization.name, image: organization.image }]] : [],
    ),
  );

  const [first] = active;
  // No customer yet is the first radio with nothing picked: what a new connection starts from.
  if (!first || (active.length === 1 && isWholeDirectory(first.rules))) {
    return {
      values: { mode: ATTRIBUTION_MODE.SOLE, soleCustomerId: first?.organizationId ?? '', customers: [] },
      archived,
      options,
    };
  }
  return {
    values: {
      mode: ATTRIBUTION_MODE.SHARED,
      soleCustomerId: '',
      customers: active.map(customer => ({
        organizationId: customer.organizationId,
        rules: customer.rules.map(toFormRule),
      })),
    },
    archived,
    options,
  };
}

/** The complete set of customers `updateDirectoryConnection` replaces the stored one with. */
export function attributionToInput(values: AttributionFormData): DirectoryConnectionCustomerInput[] {
  if (values.mode === ATTRIBUTION_MODE.SOLE) {
    return [{ organizationId: values.soleCustomerId, rules: [{ kind: DirectoryRuleKind.ALL }] }];
  }
  return values.customers.map(customer => ({
    organizationId: customer.organizationId,
    rules: customer.rules.flatMap(({ kind, values: ruleValues }): DirectoryRuleInput[] => {
      if (!kind) return [];
      return kind === DirectoryRuleKind.ALL ? [{ kind }] : [{ kind, values: ruleValues.map(value => value.id) }];
    }),
  }));
}

/**
 * Whether Save has customers to send. Compared on what would be sent, so switching the mode and back, or a
 * value's display name, is no change; leaving `customers` out is what keeps the stored set untouched.
 */
export function attributionChanged(values: AttributionFormData, stored: AttributionFormData): boolean {
  return JSON.stringify(attributionToInput(values)) !== JSON.stringify(attributionToInput(stored));
}

/** A refusal of `updateDirectoryConnection`. */
export type TenantUserError = useSaveIntegrationMutation$data['updateDirectoryConnection']['userErrors'][number];

/** The API's answer to a save that crossed another one (spec §16: no lock, the later write is refused). */
export const CONNECTION_MODIFIED_CONCURRENTLY = 'CONNECTION_MODIFIED_CONCURRENTLY';

/** The toast's description for a refused save: the API's messages once each, or what to do about a crossed save. */
export function userErrorsDescription(errors: readonly Pick<TenantUserError, 'code' | 'message'>[]): string {
  if (errors.some(error => error.code === CONNECTION_MODIFIED_CONCURRENTLY)) {
    return 'Someone else saved this tenant while you were editing. Reload the page to see their changes, then try again.';
  }
  const messages = [...new Set(errors.map(error => error.message).filter(Boolean))];
  return messages.length > 0 ? messages.join(', ') : 'Try again in a moment.';
}

/**
 * The attribution field a `userErrors[].field` names (`customers[1].rules[0].values[2]`), or `null` for one the form
 * does not draw. A single value's refusal lands on its rule's values picker; in the single-customer mode the one
 * customer is the "Select Customer" field.
 */
export function attributionFieldPath(
  field: string | null | undefined,
  mode: AttributionMode,
): FieldPath<AttributionFormData> | null {
  if (!field) return null;
  if (mode === ATTRIBUTION_MODE.SOLE) {
    return field === 'customers[0].organizationId' ? 'soleCustomerId' : null;
  }
  const path = field.replace(/\[(\d+)\]/g, '.$1').replace(/\.values\.\d+$/, '.values');
  // The test is the form's own shape, so the path names a field it has.
  return /^customers\.\d+\.(organizationId|rules\.\d+\.(kind|values))$/.test(path)
    ? (path as FieldPath<AttributionFormData>)
    : null;
}
