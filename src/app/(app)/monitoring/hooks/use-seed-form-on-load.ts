import { useState } from 'react';
import type { UseFormReset } from 'react-hook-form';

interface UseSeedFormOnLoadOptions<TData, TFormData> {
  data: TData | null | undefined;
  isEnabled: boolean;
  reset: UseFormReset<TFormData>;
  toFormValues: (data: TData) => TFormData;
  onSeeded?: (data: TData) => void;
}

// Seeds the form when the fetched record arrives (or is replaced), during render
// rather than in an effect: an effect renders the empty form once after the data
// has landed, which is a visible flash of blank fields on every load.
//
// `undefined` is a sentinel, NOT the initial value: `data` may be `null` and
// never `undefined` for a not-yet-seeded state, so the block below also runs on
// the FIRST render. Seeding the tracker with the current value instead would
// skip it entirely whenever react-query already holds the record — the standard
// details -> Edit journey — and the form would open blank.
export function useSeedFormOnLoad<TData, TFormData>({
  data,
  isEnabled,
  reset,
  toFormValues,
  onSeeded,
}: UseSeedFormOnLoadOptions<TData, TFormData>) {
  const [seededFrom, setSeededFrom] = useState<typeof data | undefined>(undefined);
  if (data !== seededFrom) {
    setSeededFrom(data);
    if (data && isEnabled) {
      reset(toFormValues(data));
      onSeeded?.(data);
    }
  }
}
