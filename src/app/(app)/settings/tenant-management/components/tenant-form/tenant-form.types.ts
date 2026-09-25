// Form schema for New / Edit Tenant Integration (CU-86akj8ajt). The customer field
// is a separate fragment on purpose: phase 2 removes the customer ↔ connection
// binding from these forms, so it must be deletable without touching the rest.

import { z } from 'zod';
import { DirectoryProvider } from '@/generated/schema-enums';

/**
 * A registrable domain (dot-joined labels, no protocol, path or spaces): it is the tenant segment
 * of the consent URL (`login.microsoftonline.com/<domain>/v2.0/adminconsent` for Microsoft 365).
 */
const DOMAIN_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
export const DOMAIN_PATTERN = new RegExp(`^${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})+$`);

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
    provider: z.enum(DirectoryProvider, { error: 'Select a provider' }),
    domain: domainSchema,
    name: nameSchema,
  })
  .extend(tenantCustomerFieldSchema.shape);

export type TenantFormData = z.infer<typeof tenantFormSchema>;

/** Edit never sends the domain, so the stored one (a GUID, or none at all) must not block Save. */
export const editTenantFormSchema = tenantFormSchema.extend({ domain: z.string() });

/** Microsoft is the first radio in the design, so it is pre-selected. */
export const TENANT_FORM_DEFAULT_VALUES: TenantFormData = {
  provider: DirectoryProvider.MICROSOFT_365,
  domain: '',
  name: '',
  organizationId: '',
};
