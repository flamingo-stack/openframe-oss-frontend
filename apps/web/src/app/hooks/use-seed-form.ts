'use client';
'use no memo';

import { useLayoutEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

interface Seed<R, T> {
  record: R;
  values: T;
}

/**
 * Fills a form that was mounted before its record arrived, and returns the record it filled the form from (null
 * until one has).
 *
 * This is what lets an edit page render its REAL form from the first paint —
 * locked, empty, and never swapped for a skeleton — instead of holding the whole
 * page behind a boundary until the query answers.
 *
 * **Call it from the component that owns `useForm`, never from the island that
 * fetches.** React Hook Form subscribes each field in a LAYOUT effect, and layout
 * effects run children first, siblings in tree order — so a `reset` fired from a
 * fetching sibling rendered ABOVE the fields reaches a form nobody is listening
 * to yet, and the values are silently dropped. That failure hides whenever the
 * query is slow (the island suspends and mounts after the fields have
 * subscribed) and reproduces every time the answer is already cached — arriving
 * from a details page, say. Owned by the parent, the seed lands after every field
 * below has subscribed.
 *
 * A layout effect for a second reason: from a passive one it would land after the
 * paint, so a cache-warm record would still cost one frame of the empty form.
 *
 * Detail queries typically run `store-and-network`, so a background refresh can
 * hand over a new object while the user is already typing. A record is taken only
 * while the form is pristine, so a refresh can never overwrite edits in progress —
 * and what the form shows, locks and diffs against is then the returned record,
 * never the latest one: the two part as soon as a refresh lands on a dirty form.
 * The choice is made in render, when a new record is offered, so the record
 * returned and the values the form holds agree from the next commit, before the
 * paint; `isDirty` there is react-hook-form's state of this render.
 *
 * Each seed is applied once. The layout effect also runs again without a new one —
 * a Suspense boundary revealing the form again, an Activity above it turning
 * visible — and a reset then would wipe the edits in progress.
 *
 * `valuesOf` picks the form's values out of a record that carries more than them.
 */
export function useSeedForm<T extends FieldValues>(form: UseFormReturn<T>, values: T | null): T | null;
export function useSeedForm<T extends FieldValues, R>(
  form: UseFormReturn<T>,
  record: R | null,
  valuesOf: (record: R) => T,
): R | null;
export function useSeedForm<T extends FieldValues, R>(
  form: UseFormReturn<T>,
  record: R | null,
  valuesOf?: (record: R) => T,
): R | null {
  const [offered, setOffered] = useState<R | null>(null);
  const [seed, setSeed] = useState<Seed<R, T> | null>(null);
  const applied = useRef<Seed<R, T> | null>(null);

  if (record !== offered) {
    setOffered(record);
    if (record !== null && record !== seed?.record && !form.formState.isDirty) {
      // Without `valuesOf` the record is the values (the first overload).
      setSeed({ record, values: valuesOf ? valuesOf(record) : (record as unknown as T) });
    }
  }

  useLayoutEffect(() => {
    if (!seed || applied.current === seed) return;
    applied.current = seed;
    form.reset(seed.values);
  }, [seed, form]);

  return seed?.record ?? null;
}
