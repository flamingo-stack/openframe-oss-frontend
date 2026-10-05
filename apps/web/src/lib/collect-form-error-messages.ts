import type { FieldErrors, FieldValues } from 'react-hook-form';

const SKIPPED_KEYS = new Set(['message', 'ref', 'types']);

/**
 * Every `message` in a react-hook-form error tree, depth-first in field order —
 * including the rows of a field array (`contacts.2.email`), which a one-level
 * `Object.values(errors).map(e => e.message)` cannot see. Error nodes also carry
 * `ref` (a DOM element or a focus handle) and `types`; both are skipped — a DOM
 * element would walk into `parentNode` / `ownerDocument` cycles.
 */
export function collectFormErrorMessages<T extends FieldValues>(errors: FieldErrors<T> | undefined): string[] {
  const messages: string[] = [];

  // Arrays and objects walk the same way: a field-array error is an array whose
  // own keys are the row indices plus RHF's `root` (an array-level issue), and
  // Object.entries lists both while skipping the holes of rows without errors.
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message) messages.push(record.message);
    for (const [key, value] of Object.entries(record)) {
      if (!SKIPPED_KEYS.has(key)) visit(value);
    }
  };

  visit(errors);
  return messages;
}
