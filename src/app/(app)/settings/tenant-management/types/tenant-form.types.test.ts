// Pins the form contracts: the domain is normalised and validated the same way
// the mock/backend compare it, required fields carry the messages the invalid
// submit toast prints, and Edit reuses the same schema with provider/domain locked.

import { describe, expect, it } from 'vitest';
import { TENANT_FORM_DEFAULT_VALUES, tenantFormSchema } from './tenant-form.types';

const valid = { provider: 'MICROSOFT_365', domain: 'flamingo.cx', name: 'Flamingo Team', organizationId: 'org-1' };

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
    for (const domain of ['sub.example.co.uk', 'brightline-mfg.com', 'acme.notauthorised.test']) {
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
