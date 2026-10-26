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
import { inactiveCustomerBadge, UNKNOWN_CUSTOMER } from '../../utils/tenant-presentation';
import {
  ATTRIBUTION_MODE,
  type AttributionCustomer,
  type AttributionFormData,
  type AttributionMode,
  type AttributionRule,
} from './attribution.types';
import type { CustomerOption, PickerCustomer } from './customer-option';

type RecordCustomer = tenantFormHelpers_connection$data['customers'][number];

/** A stored customer with its organization read into the picker's option; `null` when the document is gone. */
export type StoredCustomer = Omit<RecordCustomer, 'organization'> & {
  organization: (CustomerOption & { readonly status: string | null | undefined }) | null;
};

export interface StoredAttribution {
  values: AttributionFormData;
  /**
   * Every stored customer's option, so a picker names its customer before its list has paged to it — and names the
   * archived or deleted ones, which the list never offers, with their badge.
   */
  options: ReadonlyMap<string, PickerCustomer>;
}

/** A bound customer as every list of them names it: an archived one with its badge, a deleted one as "Unknown customer". */
export function storedOption({
  organizationId,
  organization,
}: Pick<StoredCustomer, 'organizationId' | 'organization'>): PickerCustomer {
  const badge = inactiveCustomerBadge(organization);
  return {
    organizationId,
    name: organization?.name ?? UNKNOWN_CUSTOMER,
    image: organization?.image ?? null,
    ...(badge ? { badge } : {}),
  };
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

/**
 * The stored customers as the form holds them. An archived or deleted one stays: it is kept, edited and removed like
 * any other, only never bound anew.
 */
export function readAttribution(customers: readonly StoredCustomer[]): StoredAttribution {
  const options = new Map(customers.map(customer => [customer.organizationId, storedOption(customer)]));

  const [first] = customers;
  // No customer yet is the first radio with nothing picked: what a new connection starts from.
  if (!first || (customers.length === 1 && isWholeDirectory(first.rules))) {
    return {
      values: { mode: ATTRIBUTION_MODE.SOLE, soleCustomerId: first?.organizationId ?? '', customers: [] },
      options,
    };
  }
  return {
    values: {
      mode: ATTRIBUTION_MODE.SHARED,
      soleCustomerId: '',
      customers: customers.map(customer => ({
        organizationId: customer.organizationId,
        rules: customer.rules.map(toFormRule),
      })),
    },
    options,
  };
}

/**
 * The values of `kind` every other rule of the form holds. A domain, group or org unit belongs to one rule per
 * connection; a user reached through two different values still counts for both.
 */
export function valuesClaimedElsewhere(
  customers: readonly AttributionCustomer[],
  customerIndex: number,
  ruleIndex: number,
  kind: string,
): ReadonlySet<string> {
  return new Set(
    customers.flatMap((customer, c) =>
      customer.rules.flatMap((rule, r) =>
        (c === customerIndex && r === ruleIndex) || rule.kind !== kind ? [] : rule.values.map(value => value.id),
      ),
    ),
  );
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
