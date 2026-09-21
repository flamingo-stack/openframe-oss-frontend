// Form schema for New / Edit Tenant Integration (CU-86akj8ajt).
//
// One schema for both pages: Edit renders the same fields with provider and
// domain locked (they are seeded from the record and never sent), so a second
// schema would only be a subset to keep in step. The customer field is a
// separate fragment merged in on purpose: phase 2 makes the customer ↔
// connection binding many-to-many and removes the field (Phase 2 design doc),
// so it must be deletable without touching the rest.

import { z } from 'zod';
import { DirectoryProvider } from './directory-enums';

/**
 * A registrable domain: labels of letters/digits/hyphens (no leading or trailing
 * hyphen, ≤63 chars) joined by dots, at least one dot. No protocol, no path, no
 * spaces — the value is the tenant segment of the consent URL, and the backend
 * (and the mock) compare it against the directory the admin actually consents from.
 */
const DOMAIN_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
export const DOMAIN_PATTERN = new RegExp(`^${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})+$`);

const PROVIDER_VALUES = Object.values(DirectoryProvider) as [DirectoryProvider, ...DirectoryProvider[]];

export const DOMAIN_ERROR = 'Enter a valid domain, e.g. contoso.com';

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter the domain name')
  .regex(DOMAIN_PATTERN, DOMAIN_ERROR);

const nameSchema = z.string().trim().min(1, 'Enter a connection name').max(100, 'Keep the name under 100 characters');

/** Phase-2 removal point: delete this fragment and the `.extend()` call. */
export const tenantCustomerFieldSchema = z.object({
  organizationId: z.string().min(1, 'Select a customer'),
});

export const tenantFormSchema = z
  .object({
    provider: z.enum(PROVIDER_VALUES, { error: 'Select a provider' }),
    domain: domainSchema,
    name: nameSchema,
  })
  .extend(tenantCustomerFieldSchema.shape);

export type TenantFormData = z.infer<typeof tenantFormSchema>;

/** Microsoft is the first radio in the design, so it is pre-selected. */
export const TENANT_FORM_DEFAULT_VALUES: TenantFormData = {
  provider: DirectoryProvider.MICROSOFT_365,
  domain: '',
  name: '',
  organizationId: '',
};
