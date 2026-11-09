'use client';

// What a form's Save does around its write, whatever the record: one submit at a time, the invalid submit's toast
// (then the scroll: Controllers pass no `ref`), and the description of a write the API refused.

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRef } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { collectFormErrorMessages } from '@/lib/collect-form-error-messages';
import { scrollToFirstInvalidField } from '@/lib/scroll-to-first-invalid-field';

type Toast = ReturnType<typeof useToast>['toast'];

/** The `handleSubmit` error branch: one destructive toast, then the page scrolls to the culprit. */
function invalidSubmitHandler(toast: Toast, title: string, errors: FieldErrors) {
  // Every rule of every customer can miss the same kind: each message once.
  const messages = [...new Set(collectFormErrorMessages(errors))];
  toast({
    title,
    description: messages.length > 0 ? messages.join(', ') : 'Please fill in all required fields.',
    variant: 'destructive',
  });
  scrollToFirstInvalidField();
}

/**
 * One submit at a time. `validate` runs the forms' `handleSubmit` and answers `pass` with what to save, handed to
 * `onValid`, or `fail` with the errors, toasted under `invalidTitle`. The guard is set on the click — `handleSubmit`
 * awaits the resolver, so a second click can land before the write's in-flight flag disables the button (canon
 * `use-customer-form`) — and cleared once validation has answered.
 */
export function useGuardedSubmit() {
  const { toast } = useToast();
  const validatingRef = useRef(false);

  return <V>(
    invalidTitle: string,
    validate: (pass: (values: V) => void, fail: (errors: FieldErrors) => void) => void,
    onValid: (values: V) => void,
  ) => {
    if (validatingRef.current) return;
    validatingRef.current = true;
    validate(
      values => {
        validatingRef.current = false;
        onValid(values);
      },
      errors => {
        validatingRef.current = false;
        invalidSubmitHandler(toast, invalidTitle, errors);
      },
    );
  };
}

/**
 * The directory-connection mutations' answer to a write that crossed another one (spec §16: no lock, the later write
 * is refused).
 */
export const CONNECTION_MODIFIED_CONCURRENTLY = 'CONNECTION_MODIFIED_CONCURRENTLY';

/** The toast's description for a refused save: the API's messages once each, or what to do about a crossed save. */
export function userErrorsDescription(errors: readonly { readonly code: string; readonly message: string }[]): string {
  if (errors.some(error => error.code === CONNECTION_MODIFIED_CONCURRENTLY)) {
    return 'Someone else saved this while you were editing. Reload the page to see their changes, then try again.';
  }
  const messages = [...new Set(errors.map(error => error.message).filter(Boolean))];
  return messages.length > 0 ? messages.join(', ') : 'Try again in a moment.';
}
