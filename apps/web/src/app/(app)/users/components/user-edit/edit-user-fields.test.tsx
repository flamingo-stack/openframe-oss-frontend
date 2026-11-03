'use no memo';

/**
 * A save the server refuses on one field names that field (`use-edit-user-form`): the field must then show the
 * message and mark itself invalid, or the user sees only a toast and cannot tell what to fix.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryUserField, OrgUserSource } from '@/generated/schema-enums';

// The form module's fragment and the shared barrel's tags need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));
// The manager picker reads the directory; nothing here is about it.
vi.mock('./manager-field', () => ({ ManagerField: () => null }));

import { EditUserFields } from './edit-user-fields';
import { type EditUserFormData, toEditUserRecord } from './edit-user-form';

type Person = Parameters<typeof toEditUserRecord>[0];

const RECORD = toEditUserRecord({
  accounts: [
    {
      id: 'acc-1',
      source: OrgUserSource.MICROSOFT_365,
      email: 'olivia@contoso.com',
      displayName: 'Olivia Grant',
      firstName: 'Olivia',
      lastName: 'Grant',
      phone: null,
      leavingDate: null,
      readOnlyReasons: [],
      editableFields: Object.values(DirectoryUserField),
      connection: { id: 'conn-1' },
      customers: [{ organization: { organizationId: 'org-1', name: 'Northbridge', image: null } }],
      details: {
        jobTitle: 'Designer',
        department: 'Design',
        officeLocation: null,
        usageLocation: 'GB',
        businessPhones: [],
        mobilePhone: null,
        manager: null,
      },
    },
  ],
} as unknown as Person);

let container: HTMLDivElement;
let root: Root;
let form: UseFormReturn<EditUserFormData> | null;

function Harness() {
  const edit = useForm<EditUserFormData>({ defaultValues: RECORD?.values });
  useEffect(() => {
    form = edit;
  });
  return <EditUserFields form={edit} record={RECORD} disabled={false} />;
}

describe('EditUserFields, Leaving date', () => {
  beforeEach(() => {
    form = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the error the server gave for it, and marks the picker invalid', () => {
    act(() => root.render(<Harness />));
    expect(container.querySelector('[data-invalid]')).toBeNull();

    act(() => form?.setError('leavingDate', { type: 'server', message: 'Leaving date must be in the future' }));
    expect(container.textContent).toContain('Leaving date must be in the future');
    expect(container.querySelector('[data-invalid]')).not.toBeNull();
  });
});
