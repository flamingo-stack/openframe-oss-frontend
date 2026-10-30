'use client';

import { CalendarBookmarkIcon, XmarkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState, useSyncExternalStore } from 'react';
import { BookCallWalkthroughVideo } from '@/app/(app)/onboarding/components/book-call/book-call-walkthrough-video';
import { useOnboardingMeetingLink } from '@/app/(app)/onboarding/components/book-call/use-onboarding-meeting-link';
import { BookCallModal } from '@/app/(app)/setup/components/book-call-modal';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { useWalkthroughVideoData } from '@/app/hooks/use-walkthrough-video-data';

const DISMISSED_KEY_PREFIX = 'openframe:mingo-intro-dismissed:';

const dismissListeners = new Set<() => void>();

function subscribeDismissed(listener: () => void): () => void {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

function readDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * The banner's closed flag, per user on this device. An external-store read
 * rather than state seeded from storage, so the server-rendered markup (never
 * dismissed) and the first client render agree, and the flag applies right
 * after hydration.
 */
function useDismissed(key: string): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    () => readDismissed(key),
    () => false,
  );
  const dismiss = () => {
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // Blocked storage: the banner closes for this page view only.
    }
    for (const listener of dismissListeners) listener();
  };
  return [dismissed, dismiss];
}

/**
 * "OpenFrame isn't your typical RMM": the dashboard's welcome under onboarding
 * v2 - the intro clip and an onboarding call, in the accent frame, above the
 * overview. Stacked while the content is narrow (Mingo docked beside it), the
 * clip beside the copy from `content-lg`. Closed for good with the X, per user
 * on this device. Nothing to offer - no clip and no bookable call - means no
 * banner. `loading`: whether it shows at all is not known yet, so it draws its
 * loading form, the clip's slot and the button locked, as it does for its own reads.
 */
export function MingoIntroBanner({ loading = false }: { loading?: boolean }) {
  const userId = useAuthStore(state => state.user?.id);
  const [dismissed, dismiss] = useDismissed(`${DISMISSED_KEY_PREFIX}${userId ?? 'anonymous'}`);
  const { link, isLoading: linkLoading } = useOnboardingMeetingLink();
  const { video, isLoading: videoLoading } = useWalkthroughVideoData();
  const [booking, setBooking] = useState(false);

  if (dismissed) return null;
  const hasVideo = loading || videoLoading || Boolean(video?.mainVideoUrl || video?.youtubeUrl);
  const hasCall = loading || linkLoading || Boolean(link);
  if (!hasVideo && !hasCall) return null;

  const title = (
    <div className="flex items-center gap-[var(--spacing-system-xxs)]">
      <CalendarBookmarkIcon size={16} className="shrink-0 text-ods-accent" />
      <h3 className="min-w-0 flex-1 truncate text-ods-text-primary text-h3">OpenFrame isn&apos;t your typical RMM</h3>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-ods-accent hover:text-ods-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
      >
        <XmarkIcon size={16} />
      </button>
    </div>
  );

  return (
    <section
      aria-label="OpenFrame isn't your typical RMM"
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-sf)] rounded-md border border-ods-accent bg-ods-open-yellow-secondary p-[var(--spacing-system-sf)]',
        'content-lg:flex-row content-lg:items-start content-lg:gap-[var(--spacing-system-m)]',
      )}
    >
      {/* Narrow: the title row leads, the clip under it. Wide: the clip leads
          and the title row moves into the copy column. */}
      <div className="content-lg:hidden">{title}</div>
      {hasVideo && (
        <LoadingWhen loading={loading}>
          <BookCallWalkthroughVideo className="w-full content-lg:w-[216px] content-lg:shrink-0 content-lg:self-start" />
        </LoadingWhen>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xs)]">
        <div className="hidden content-lg:block">{title}</div>
        <p className="text-ods-text-primary text-h6">
          You describe the outcome, Mingo does the work, you approve it. Most new users only ask it questions.
          We&apos;ll show you how to hand it real jobs instead.
        </p>
        {hasCall && (
          <Button
            variant="accent"
            leftIcon={<CalendarBookmarkIcon className="size-5" />}
            onClick={() => setBooking(true)}
            disabled={loading || !link}
            className="mt-[var(--spacing-system-xs)] w-auto self-start"
          >
            Book a Call
          </Button>
        )}
      </div>
      <BookCallModal open={booking} onClose={() => setBooking(false)} />
    </section>
  );
}
