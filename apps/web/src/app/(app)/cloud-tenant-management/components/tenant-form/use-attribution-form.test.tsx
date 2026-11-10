/**
 * The two cross-field rules put their error on a field other than the one that fixes them. Fixing the clash must clear
 * the error then, not only at the next Save, and re-checking must touch no field that was not showing an error.
 */

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DirectoryRuleKind } from '@/generated/schema-enums';
import { ATTRIBUTION_MODE, type AttributionCustomer, type AttributionFormData, newRule } from './attribution.types';
import { useAttributionForm } from './use-attribution-form';

type AttributionForm = ReturnType<typeof useAttributionForm>['form'];

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

function mountForm(customers: AttributionCustomer[]): AttributionForm {
  const initial: AttributionFormData = { mode: ATTRIBUTION_MODE.SHARED, soleCustomerId: '', customers };
  const holder: { form?: AttributionForm } = {};
  function Probe() {
    const { form } = useAttributionForm(initial);
    // Recorded after the commit, never during render.
    useEffect(() => {
      holder.form = form;
    }, [form]);
    return null;
  }
  root = createRoot(document.createElement('div'));
  act(() => root?.render(<Probe />));
  if (!holder.form) throw new Error('the form did not mount');
  return holder.form;
}

/** Runs a change, then lets the watcher's microtask and the resolver it starts answer. */
async function settle(change: () => void) {
  await act(async () => {
    change();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

/** A failed Save: every field's error is on screen. */
const failSave = (form: AttributionForm) => settle(() => void form.handleSubmit(() => {})());

const groupRule = (id: string) => ({ kind: DirectoryRuleKind.GROUP, values: [{ id, name: id }] });
const ALL_RULE = { kind: DirectoryRuleKind.ALL, values: [] };
const ALL_ERROR = 'All accounts needs this to be the only customer';

describe('useAttributionForm', () => {
  it('clears "All accounts" once the other customers are gone', async () => {
    const acme = { organizationId: 'acme', rules: [ALL_RULE] };
    const form = mountForm([acme, { organizationId: 'lab', rules: [groupRule('g-1')] }]);
    await failSave(form);
    expect(form.getFieldState('customers.0.rules.0.kind').error?.message).toBe(ALL_ERROR);

    await settle(() => form.setValue('customers', [acme]));
    expect(form.getFieldState('customers.0.rules.0.kind').error).toBeUndefined();
  });

  it("clears a value's clash once the other rule lets it go", async () => {
    const form = mountForm([
      { organizationId: 'acme', rules: [groupRule('g-1')] },
      { organizationId: 'lab', rules: [groupRule('g-1')] },
    ]);
    await failSave(form);
    expect(form.getFieldState('customers.1.rules.0.values').error?.message).toBe('g-1 is already in another rule');

    await settle(() => form.setValue('customers.0.rules.0.values', [{ id: 'g-2', name: 'g-2' }]));
    expect(form.getFieldState('customers.1.rules.0.values').error).toBeUndefined();
  });

  it('re-checks every clash on screen, so fixing one leaves the other', async () => {
    const form = mountForm([
      { organizationId: 'acme', rules: [groupRule('g-1')] },
      { organizationId: 'lab', rules: [groupRule('g-1')] },
      { organizationId: 'harbor', rules: [groupRule('g-2')] },
      { organizationId: 'globex', rules: [groupRule('g-2')] },
    ]);
    await failSave(form);
    expect(form.getFieldState('customers.1.rules.0.values').error?.message).toBe('g-1 is already in another rule');
    expect(form.getFieldState('customers.3.rules.0.values').error?.message).toBe('g-2 is already in another rule');

    await settle(() => form.setValue('customers.2.rules.0.values', [{ id: 'g-3', name: 'g-3' }]));
    expect(form.getFieldState('customers.3.rules.0.values').error).toBeUndefined();
    expect(form.getFieldState('customers.1.rules.0.values').error?.message).toBe('g-1 is already in another rule');
  });

  it('leaves a customer added after a failed Save clean until the next Save', async () => {
    const form = mountForm([
      { organizationId: 'acme', rules: [ALL_RULE] },
      { organizationId: 'lab', rules: [groupRule('g-1')] },
    ]);
    await failSave(form);

    await settle(() =>
      form.setValue('customers', [
        ...form.getValues('customers'),
        // What "Add Customer" appends (`attribution-fields.tsx`).
        { organizationId: '', rules: [newRule()] },
      ]),
    );
    expect(form.getFieldState('customers.0.rules.0.kind').error?.message).toBe(ALL_ERROR);
    expect(form.getFieldState('customers.2.organizationId').error).toBeUndefined();
    expect(form.getFieldState('customers.2.rules.0.kind').error).toBeUndefined();
  });

  it("keeps the server's refusal through an edit elsewhere", async () => {
    const form = mountForm([
      { organizationId: 'acme', rules: [ALL_RULE] },
      { organizationId: 'lab', rules: [groupRule('g-1')] },
    ]);
    await failSave(form);
    act(() => form.setError('customers.1.organizationId', { type: 'server', message: 'Lab is archived' }));

    await settle(() => form.setValue('customers.1.rules.0.values', [{ id: 'g-2', name: 'g-2' }]));
    expect(form.getFieldState('customers.1.organizationId').error?.message).toBe('Lab is archived');
  });

  it("keeps a Match by change's values starting clean", async () => {
    const form = mountForm([{ organizationId: 'acme', rules: [{ kind: DirectoryRuleKind.GROUP, values: [] }] }]);
    await failSave(form);
    expect(form.getFieldState('customers.0.rules.0.values').error?.message).toBe('Select at least one value');

    // What the rule's "Match by" does (`attribution-customer-card.tsx`): new kind, empty values, their error cleared.
    await settle(() => {
      form.setValue('customers.0.rules.0.kind', DirectoryRuleKind.DOMAIN);
      form.setValue('customers.0.rules.0.values', []);
      form.clearErrors('customers.0.rules.0.values');
    });
    expect(form.getFieldState('customers.0.rules.0.values').error).toBeUndefined();
  });

  it('checks nothing before an error is on screen', async () => {
    const form = mountForm([
      { organizationId: 'acme', rules: [ALL_RULE] },
      { organizationId: 'lab', rules: [groupRule('g-1')] },
    ]);

    await settle(() => form.setValue('customers.1.rules.0.values', [{ id: 'g-2', name: 'g-2' }]));
    expect(form.getFieldState('customers').invalid).toBe(false);
  });
});
