'use no memo';

/**
 * The record the hook returns is the one the form holds: what an edit page locks its fields by and diffs Save
 * against. A refresh that lands on a dirty form is not taken, so it must not be returned either.
 */

import { Activity, act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSeedForm } from './use-seed-form';

interface Values {
  name: string;
}

interface StoredRecord {
  id: string;
  values: Values;
}

const record = (name: string): StoredRecord => ({ id: `rec-${name}`, values: { name } });

let container: HTMLDivElement;
let root: Root;
let seen: { form: UseFormReturn<Values>; seeded: unknown } | null;

function RecordHarness({ stored }: { stored: StoredRecord | null }) {
  const form = useForm<Values>({ defaultValues: { name: '' } });
  const seeded = useSeedForm(form, stored, picked => picked.values);
  useEffect(() => {
    seen = { form, seeded };
  });
  return null;
}

function ValuesHarness({ values }: { values: Values | null }) {
  const form = useForm<Values>({ defaultValues: { name: '' } });
  const seeded = useSeedForm(form, values);
  useEffect(() => {
    seen = { form, seeded };
  });
  return null;
}

function current() {
  if (!seen) throw new Error('the harness did not render');
  return seen;
}

describe('useSeedForm', () => {
  beforeEach(() => {
    seen = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('returns nothing until a record arrives, then the record it filled the form from', () => {
    act(() => root.render(<RecordHarness stored={null} />));
    expect(current().seeded).toBeNull();

    const first = record('Acme');
    act(() => root.render(<RecordHarness stored={first} />));
    expect(current().seeded).toBe(first);
    expect(current().form.getValues('name')).toBe('Acme');
  });

  it('keeps the record it seeded while a refresh lands on a dirty form', () => {
    const first = record('Acme');
    act(() => root.render(<RecordHarness stored={first} />));
    act(() => current().form.setValue('name', 'Acme EU', { shouldDirty: true }));

    act(() => root.render(<RecordHarness stored={record('Acme Corp')} />));
    expect(current().seeded).toBe(first);
    expect(current().form.getValues('name')).toBe('Acme EU');
  });

  it('takes a refresh that lands on a pristine form', () => {
    act(() => root.render(<RecordHarness stored={record('Acme')} />));
    const next = record('Acme Corp');
    act(() => root.render(<RecordHarness stored={next} />));
    expect(current().seeded).toBe(next);
    expect(current().form.getValues('name')).toBe('Acme Corp');
  });

  it('keeps the edits when its effect runs again without a new record', () => {
    const first = record('Acme');
    const page = (mode: 'hidden' | 'visible') => (
      <Activity mode={mode}>
        <RecordHarness stored={first} />
      </Activity>
    );
    act(() => root.render(page('visible')));
    act(() => current().form.setValue('name', 'Acme EU', { shouldDirty: true }));

    // Hiding and revealing an Activity destroys and re-creates the layout effects under it, the seed unchanged.
    act(() => root.render(page('hidden')));
    act(() => root.render(page('visible')));
    expect(current().seeded).toBe(first);
    expect(current().form.getValues('name')).toBe('Acme EU');
  });

  it('returns the values themselves when given no record around them', () => {
    const values = { name: 'Acme' };
    act(() => root.render(<ValuesHarness values={values} />));
    expect(current().seeded).toBe(values);
    expect(current().form.getValues('name')).toBe('Acme');
  });
});
