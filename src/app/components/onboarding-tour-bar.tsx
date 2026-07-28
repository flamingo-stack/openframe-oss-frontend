'use client';

import { CompassIcon, RouteIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AnnouncementBarView, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * Full-width banner rendered in the app layout's `topBar` slot (above sidebar +
 * header) that invites the user into the "Get Started" tour. Same accent-yellow
 * surface as {@link InitialSetupBar}; shown on every page until the user opens
 * the onboarding page. Hidden on `/onboarding` itself; visibility is decided by
 * the caller.
 *
 * Markup/responsiveness come from the shared {@link AnnouncementBarView}
 * (Figma 9364-40603 / 9418-43969 / ODS 2862-8391 mobile, mirrors
 * {@link InitialSetupBar}): one row from `md` up with the CTA at content
 * width, below `md` the CTA is full-width on its own row under the icon +
 * wrapping title. The CTA reads "Take the Tour" until the first step is done,
 * then "Continue Onboarding" (`started`). Button matches Figma —
 * `variant="outline" size="small"` (dark card surface, uppercase `text-h5`
 * label) with a leading route glyph.
 *
 * Below `md` the view CSS-hides the CTA and the whole content row becomes the
 * tap target (`onContentClick` → the same `onStart` the button fires) — the
 * hub announcement bar's touch-first behavior.
 *
 * `showAction` (default true) — when false the CTA is not rendered at all and
 * the row tap target is disabled (the bar is inert on `/onboarding` itself).
 *
 * Height is STABLE per breakpoint regardless of `showAction`: on `md`+ the
 * bar reserves 48px (`md:min-h-12` — what the view's 44px strip stretches to
 * with the 32px `size="small"` CTA inside its 8px row paddings), so toggling
 * the button never resizes the bar; below `md` the CTA is CSS-hidden either
 * way and the strip stays 44px.
 */
export function OnboardingTourBar({
  onStart,
  started = false,
  showAction = true,
}: {
  onStart: () => void;
  started?: boolean;
  showAction?: boolean;
}) {
  return (
    <AnnouncementBarView
      className="app-top-bar shrink-0 bg-ods-accent text-ods-text-on-accent md:min-h-12"
      contentClassName={showAction ? 'cursor-pointer md:cursor-default' : undefined}
      onContentClick={showAction ? onStart : undefined}
      startAdornment={<CompassIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title="Learn the basics with a quick guided tour."
      actionBlock={
        showAction ? (
          <Button
            variant="outline"
            size="small"
            leftIcon={<RouteIcon className="text-ods-text-secondary" />}
            onClick={onStart}
          >
            {started ? 'Continue Onboarding' : 'Take the Tour'}
          </Button>
        ) : undefined
      }
    />
  );
}
