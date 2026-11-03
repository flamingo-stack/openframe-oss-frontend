/** The booking form starts with the signed-in user's name and email; the scheduler's own values win. */
import type { BookingFormProps } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { SignedInBookingForm } from './signed-in-booking-form';

const bookingForm = vi.fn((_props: { initialValues?: Record<string, unknown> }) => null);

vi.mock('@flamingo-stack/openframe-frontend-core/components/meeting-scheduler', () => ({
  BookingForm: (props: { initialValues?: Record<string, unknown> }) => bookingForm(props),
}));

let root: Root;

beforeEach(() => {
  root = createRoot(document.createElement('div'));
  bookingForm.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  useAuthStore.setState({ user: null });
});

const render = (props: Partial<BookingFormProps> = {}) =>
  act(() => root.render(<SignedInBookingForm {...(props as BookingFormProps)} />));

const initialValues = () => bookingForm.mock.lastCall?.[0].initialValues;

describe('SignedInBookingForm', () => {
  it("fills in the user's name and email", () => {
    useAuthStore.setState({ user: { id: 'u', email: 'ann@acme.io', firstName: 'Ann', lastName: 'Lee' } as never });
    render();

    expect(initialValues()).toEqual({ firstName: 'Ann', lastName: 'Lee', email: 'ann@acme.io' });
  });

  it('leaves a missing name empty', () => {
    useAuthStore.setState({ user: { id: 'u', email: 'ann@acme.io' } as never });
    render();

    expect(initialValues()).toEqual({ firstName: '', lastName: '', email: 'ann@acme.io' });
  });

  it("keeps the scheduler's own values for a remount", () => {
    useAuthStore.setState({ user: { id: 'u', email: 'ann@acme.io', firstName: 'Ann' } as never });
    render({ initialValues: { firstName: 'Annie' } });

    expect(initialValues()).toMatchObject({ firstName: 'Annie', email: 'ann@acme.io' });
  });
});
