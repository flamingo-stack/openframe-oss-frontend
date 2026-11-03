'use no memo';

/**
 * A save the server refuses on one field names that field (`use-edit-user-form`): the field must then show the
 * message and mark itself invalid, or the user sees only a toast and cannot tell what to fix.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The form module's fragment and the shared barrel's tags need the Babel transform vitest does not run.
// `readInlineData` hands the node back: the fixture's record carries the nested fragments' fields flat.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));
// The manager picker reads the directory; nothing here is about it.
vi.mock('./manager-field', () => ({ ManagerField: () => null }));

import { userRecord } from './__tests__/edit-user-fixtures';
import { EditUserFields } from './edit-user-fields';
import type { EditUserFormData } from './edit-user-form';

const RECORD = userRecord();

let container: HTMLDivElement;
let root: Root;
let form: UseFormReturn<EditUserFormData> | null;

function Harness() {
  const edit = useForm<EditUserFormData>({ defaultValues: RECORD.values });
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

  it('is named by its label, so a click on it opens the picker', () => {
    act(() => root.render(<Harness />));
    const label = [...container.querySelectorAll('label')].find(node => node.textContent === 'Leaving date');
    expect(label?.control?.tagName).toBe('BUTTON');
  });
});
