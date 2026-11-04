'use client';

import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import type { SchedulingLink } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatDateWithTimezone, VIEWER_TIMEZONE } from '@flamingo-stack/openframe-frontend-core/utils';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';
import { useSchedulingLinks } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';
import { SignedInBookingForm } from '@/app/components/shared/signed-in-booking-form';

/**
 * The HubSpot link billing call-backs are booked on ("OpenFrame Support", the
 * hub's `cancellation-billing` audience), found in the directory by its public
 * URL: audience labels are content-managed. No fallback to another link: a
 * billing call on someone else's calendar reaches the wrong people.
 */
const BILLING_MEETING_PATH = '/conrad-lunderstedt/openframe-support';

function isBillingLink(link: SchedulingLink): boolean {
  try {
    return new URL(link.link).pathname.replace(/\/+$/, '') === BILLING_MEETING_PATH;
  } catch {
    return false;
  }
}

function useBillingMeetingLink(): { link: SchedulingLink | null; isLoading: boolean } {
  const query = useSchedulingLinks();
  const link = query.data?.purposes.flatMap(group => group.links).find(isBillingLink) ?? null;
  return { link, isLoading: query.isPending };
}

/**
 * Contact Support's "Call Me Back" tab: the lib's scheduler in its modal layout
 * (host strip, Select Date & Time, Continue), as `MeetingSchedulerModal` draws it
 * inside its own window — here inside the support modal instead.
 */
export function BillingCallBack({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const { link, isLoading } = useBillingMeetingLink();

  if (!link && !isLoading) {
    return <p className="text-ods-text-secondary text-h4">No billing calls can be booked right now.</p>;
  }

  return (
    <LoadingWhen loading={!link}>
      <HubSpotMeetingScheduler
        layout="modal"
        meetingId={link?.id ?? ''}
        apiBaseUrl={CONTENT_BASE}
        hosts={link?.hosts}
        fallbackUrl={link?.link}
        detailsForm={SignedInBookingForm}
        // A phone's Cancel: the window has no X there.
        onBack={onDone}
        onBooked={booking => {
          const when = formatDateWithTimezone(booking.startTimeMs, VIEWER_TIMEZONE, 'weekdayDateTimeZoned', {
            viewerLocale: true,
          });
          toast({
            title: 'Call booked',
            description: `${booking.title} - ${when}. Check your email for the invite.`,
            variant: 'success',
          });
          onDone();
        }}
      />
    </LoadingWhen>
  );
}
