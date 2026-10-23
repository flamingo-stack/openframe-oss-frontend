// Form schema for "Customers and attribution" (Figma 3126-14295, 3562-27507): the customers a
// directory serves and the rules that claim their accounts. A form of its own, beside the
// connection's fields: Connect and Reconnect hold it until the directory is readable, and Save
// sends the customers only when they changed.

import { z } from 'zod';
import { DirectoryRuleKind } from '@/generated/schema-enums';

/**
 * The two radios. `sole` is one customer that owns every account (stored as a single `ALL` rule);
 * `shared` is several customers, each claiming its accounts by domain, group or org unit.
 */
export const ATTRIBUTION_MODE = { SOLE: 'sole', SHARED: 'shared' } as const;
export type AttributionMode = (typeof ATTRIBUTION_MODE)[keyof typeof ATTRIBUTION_MODE];

const ruleValueSchema = z.object({
  id: z.string(),
  /** The directory's display name; `null` once the directory no longer has the value. */
  name: z.string().nullable(),
});

const ruleSchema = z.object({
  /** `''` until "Match by" is picked. */
  kind: z.union([z.enum(DirectoryRuleKind), z.literal('')]),
  values: z.array(ruleValueSchema),
});

const customerSchema = z.object({
  /** `''` until the customer is picked. */
  organizationId: z.string(),
  rules: z.array(ruleSchema),
});

export const attributionFormSchema = z
  .object({
    mode: z.enum(ATTRIBUTION_MODE),
    soleCustomerId: z.string(),
    customers: z.array(customerSchema),
  })
  // Only the mode on screen is checked: the other keeps what was typed there, in case the user switches back.
  .superRefine((form, ctx) => {
    if (form.mode === ATTRIBUTION_MODE.SOLE) {
      if (!form.soleCustomerId) {
        ctx.addIssue({ code: 'custom', path: ['soleCustomerId'], message: 'Select a customer' });
      }
      return;
    }
    form.customers.forEach((customer, index) => {
      if (!customer.organizationId) {
        ctx.addIssue({ code: 'custom', path: ['customers', index, 'organizationId'], message: 'Select a customer' });
      }
      customer.rules.forEach((rule, ruleIndex) => {
        const path = ['customers', index, 'rules', ruleIndex];
        if (!rule.kind) {
          ctx.addIssue({ code: 'custom', path: [...path, 'kind'], message: 'Select what to match by' });
        } else if (rule.kind !== DirectoryRuleKind.ALL && rule.values.length === 0) {
          ctx.addIssue({ code: 'custom', path: [...path, 'values'], message: 'Select at least one value' });
        }
      });
    });
  });

export type AttributionFormData = z.infer<typeof attributionFormSchema>;
export type AttributionCustomer = AttributionFormData['customers'][number];
export type AttributionRule = AttributionCustomer['rules'][number];
export type RuleValue = AttributionRule['values'][number];

/** A rule with nothing picked yet: a fresh object each time, so field arrays never share its `values`. */
export const newRule = (): AttributionRule => ({ kind: '', values: [] });

export const ATTRIBUTION_DEFAULT_VALUES: AttributionFormData = {
  mode: ATTRIBUTION_MODE.SOLE,
  soleCustomerId: '',
  customers: [],
};
