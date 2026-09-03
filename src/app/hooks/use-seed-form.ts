'use client';
'use no memo';

import { useLayoutEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

/**
 * Fills a form that was mounted before its record arrived.
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
 * hand over a new object while the user is already typing. `isDirty` is read
 * inside the effect rather than tracked as a dependency, so the check is against
 * the form as it stands and a refresh can never overwrite edits in progress.
 */
export function useSeedForm<T extends FieldValues>(form: UseFormReturn<T>, values: T | null) {
  const seeded = useRef<T | null>(null);

  useLayoutEffect(() => {
    if (!values || seeded.current === values || form.formState.isDirty) {
      return;
    }
    seeded.current = values;
    form.reset(values);
  }, [values, form]);
}
