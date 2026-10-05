// Pins the form contracts: the domain is normalised and validated as the consent URL
// needs it, required fields carry the messages the invalid submit toast prints, and
// Edit does not validate the domain it never sends.

import { describe, expect, it } from 'vitest';
import { DirectoryProvider } from '@/generated/schema-enums';
import { editTenantFormSchema, TENANT_FORM_DEFAULT_VALUES, tenantFormSchema } from './tenant-form.types';

const valid = {
  provider: DirectoryProvider.MICROSOFT_365,
  domain: 'flamingo.cx',
  name: 'Flamingo Team',
  organizationId: 'org-1',
};

describe('tenantFormSchema', () => {
  it('trims and lowercases the domain', () => {
    const parsed = tenantFormSchema.parse({ ...valid, domain: '  Flamingo.CX ' });
    expect(parsed.domain).toBe('flamingo.cx');
  });

  it('rejects a domain with a protocol, a path, inner whitespace or no dot', () => {
    for (const domain of [
      'https://flamingo.cx',
      'flamingo.cx/admin',
      'flamingo cx',
      'flamingo',
      '-bad.example',
      'bad-.example',
    ]) {
      expect(tenantFormSchema.safeParse({ ...valid, domain }).success, domain).toBe(false);
    }
  });

  it('accepts multi-label domains with hyphens', () => {
    for (const domain of ['sub.example.co.uk', 'contoso-mfg.com', 'acme.onmicrosoft.com']) {
      expect(tenantFormSchema.safeParse({ ...valid, domain }).success, domain).toBe(true);
    }
  });

  it('requires provider, name and customer, and rejects a whitespace-only name', () => {
    expect(tenantFormSchema.safeParse({ ...valid, provider: 'OKTA' }).success).toBe(false);
    expect(tenantFormSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(tenantFormSchema.safeParse({ ...valid, organizationId: '' }).success).toBe(false);
  });

  it('reports exactly the three empty required fields on the pristine defaults', () => {
    const result = tenantFormSchema.safeParse(TENANT_FORM_DEFAULT_VALUES);
    if (result.success) throw new Error('pristine defaults must not validate');
    const paths = [...new Set(result.error.issues.map(issue => issue.path.join('.')))].sort();
    expect(paths).toEqual(['domain', 'name', 'organizationId']);
  });
});

describe('editTenantFormSchema', () => {
  it('saves a connection whose stored domain is empty or not a hostname — Edit never sends it', () => {
    expect(editTenantFormSchema.safeParse({ ...valid, domain: '' }).success).toBe(true);
    expect(editTenantFormSchema.safeParse({ ...valid, domain: '0F6C0E7E-GUID' }).success).toBe(true);
  });

  it('still requires what Edit does send', () => {
    const result = editTenantFormSchema.safeParse({ ...valid, name: ' ', organizationId: '' });
    if (result.success) throw new Error('an empty name and customer must not validate');
    expect(result.error.issues.map(issue => issue.path.join('.')).sort()).toEqual(['name', 'organizationId']);
  });
});
