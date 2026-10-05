/**
 * Pins the invalid-submit toast contract for forms with field arrays: row
 * errors nested under `contacts[i]` are reported, and the DOM element RHF hangs
 * on every error node (`ref`) is never walked. Each assertion was verified to
 * fail with its guard removed.
 */

import type { FieldErrors, FieldValues } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { collectFormErrorMessages } from './collect-form-error-messages';

/** The trees below are what RHF hands to the invalid-submit handler; typed loosely on purpose. */
const asErrors = (tree: unknown) => tree as FieldErrors<FieldValues>;

describe('collectFormErrorMessages', () => {
  it('reads top-level and nested field-array messages in field order', () => {
    const errors = {
      name: { type: 'too_small', message: 'Customer name is required' },
      contacts: [undefined, { email: { type: 'custom', message: 'Enter a valid email address' } }],
    };

    expect(collectFormErrorMessages(asErrors(errors))).toEqual([
      'Customer name is required',
      'Enter a valid email address',
    ]);
  });

  it('includes an array-level root message and skips ref / types', () => {
    const input = document.createElement('input');
    const errors = {
      contacts: Object.assign(
        [{ phone: { type: 'too_big', message: 'Keep the phone under 32 characters', ref: input } }],
        {
          root: { type: 'custom', message: 'At least one contact', types: { custom: 'ignored' } },
        },
      ),
    };

    expect(collectFormErrorMessages(asErrors(errors))).toEqual([
      'Keep the phone under 32 characters',
      'At least one contact',
    ]);
  });

  it('returns nothing for an empty or missing tree', () => {
    expect(collectFormErrorMessages(undefined)).toEqual([]);
    expect(collectFormErrorMessages(asErrors({}))).toEqual([]);
  });
});
