/**
 * Call Me Back books the "OpenFrame Support" link, found by its URL in whichever audience
 * the hub files it under, and never another link (CU-17tkuw61dcb).
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingCallBack } from './billing-call-back';
import { SignedInBookingForm } from './signed-in-booking-form';

const directory = vi.hoisted(() => ({ current: { data: undefined as unknown, isPending: true } }));
const scheduler = vi.fn((_props: { meetingId: string; detailsForm?: unknown }) => <div>scheduler</div>);

vi.mock('@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link', () => ({
  useSchedulingLinks: () => directory.current,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/meeting-scheduler', () => ({
  HubSpotMeetingScheduler: (props: { meetingId: string }) => scheduler(props),
}));
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', () => ({
  LoadingWhen: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./signed-in-booking-form', () => ({ SignedInBookingForm: () => null }));

const link = (id: string, url: string) => ({ id, link: url, hosts: [] });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  scheduler.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
});

const render = () => act(() => root.render(<BillingCallBack onDone={() => {}} />));

describe('BillingCallBack', () => {
  it('books the support link, whatever audience it sits in, with the signed-in form', () => {
    directory.current = {
      isPending: false,
      data: {
        purposes: [
          {
            purpose: 'openframe-users',
            links: [link('1', 'https://meetings.hubspot.com/michael-assraf/call-sales-openframe-demo')],
          },
          {
            purpose: 'cancellation-billing',
            links: [link('13765660', 'https://meetings.hubspot.com/conrad-lunderstedt/openframe-support/')],
          },
        ],
      },
    };
    render();

    expect(scheduler).toHaveBeenLastCalledWith(
      expect.objectContaining({ meetingId: '13765660', detailsForm: SignedInBookingForm }),
    );
  });

  it('says no call can be booked when the directory lacks the link, instead of booking another', () => {
    directory.current = {
      isPending: false,
      data: {
        purposes: [{ purpose: 'openframe-users', links: [link('1', 'https://meetings.hubspot.com/michael-assraf')] }],
      },
    };
    render();

    expect(scheduler).not.toHaveBeenCalled();
    expect(container.textContent).toContain('No billing calls can be booked right now.');
  });

  it('does not say so while the directory loads', () => {
    directory.current = { isPending: true, data: undefined };
    render();

    expect(container.textContent).not.toContain('No billing calls');
  });
});
