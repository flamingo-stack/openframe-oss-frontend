'use client';

import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import type { SchedulingLink } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatDateWithTimezone, VIEWER_TIMEZONE } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { CONTENT_BASE } from '@/app/(app)/help-center/endpoints';
import { useSchedulingLinks } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';
import { SignedInBookingForm } from '@/app/components/shared/signed-in-booking-form';

/**
 * The HubSpot link call-backs are booked on ("OpenFrame Support", the hub's
 * `cancellation-billing` audience), found in the directory by its public URL:
 * audience labels are content-managed. No fallback to another link: a call on
 * someone else's calendar reaches the wrong people.
 *
 * The Help Center's Contact Support books the same link on purpose (CU-86akejptf);
 * a support audience of its own is an open question, which is why the path is a
 * prop rather than baked in.
 */
export const SUPPORT_MEETING_PATH = '/conrad-lunderstedt/openframe-support';

function matchesPath(link: SchedulingLink, path: string): boolean {
  try {
    return new URL(link.link).pathname.replace(/\/+$/, '') === path;
  } catch {
    return false;
  }
}

function useMeetingLink(path: string): { link: SchedulingLink | null; isLoading: boolean } {
  const query = useSchedulingLinks();
  const link = query.data?.purposes.flatMap(group => group.links).find(each => matchesPath(each, path)) ?? null;
  return { link, isLoading: query.isPending };
}

interface BillingCallBackProps {
  onDone: () => void;
  /** The public URL path of the one link to book, as {@link SUPPORT_MEETING_PATH}. */
  meetingPath: string;
  /** What the tab says when the directory has no such link. */
  emptyMessage: string;
  /** The modal's email line, drawn over Continue / Confirm Booking. */
  footnote?: ReactNode;
}

/**
 * The scheduler's modal layout is one stack, `[card, footer]`, with no slot
 * between the two, and the design puts the email line there (settings 2653:142746).
 * So its root steps out of the layout (`contents`) and its two children become
 * items of the column below: the card first, then the footnote (`order-1`), then
 * the footer (`order-2`). The footnote's `mt-auto` keeps it and the footer at the
 * bottom of the fixed-height window, where the ticket tab has its Send.
 * If the lib changes that root, the line moves; the live check covers it.
 */
const SCHEDULER_SPLIT_CLASS = 'contents [&>*:last-child]:order-2';

/**
 * Contact Support's "Call Me Back" tab: the lib's scheduler in its modal layout
 * (host strip, Select Date & Time, Continue), as `MeetingSchedulerModal` draws it
 * inside its own window — here inside the support modal instead.
 */
export function BillingCallBack({ onDone, meetingPath, emptyMessage, footnote }: BillingCallBackProps) {
  const { toast } = useToast();
  const { link, isLoading } = useMeetingLink(meetingPath);
  const footnoteBlock = footnote ? <div className="order-1 mt-auto">{footnote}</div> : null;

  if (!link && !isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
        <p className="text-ods-text-secondary text-h4">{emptyMessage}</p>
        {footnoteBlock}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">
      <LoadingWhen loading={!link}>
        <HubSpotMeetingScheduler
          className={SCHEDULER_SPLIT_CLASS}
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
      {footnoteBlock}
    </div>
  );
}
