'use client';

import {
  BookingForm,
  type BookingFormProps,
} from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';

/**
 * The lib's booking form with the signed-in user's name and email filled in, for
 * a scheduler's `detailsForm`. Through `initialValues`, not `answers`: `answers`
 * reaches only the link's own questions, never these built-ins. The form reads
 * its defaults once, at the details step, well after the session has loaded;
 * the scheduler's own values for a remount (the back edge) still win.
 */
export function SignedInBookingForm({ initialValues, ...props }: BookingFormProps) {
  const user = useAuthStore(state => state.user);

  return (
    <BookingForm
      {...props}
      initialValues={{
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        email: user?.email ?? '',
        ...initialValues,
      }}
    />
  );
}
