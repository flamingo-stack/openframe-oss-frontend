'use client';

import { CompassIcon, RouteIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AnnouncementBarView, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Full-width banner rendered in the app layout's `topBar` slot (above sidebar +
 * header) that invites the user into the "Get Started" tour. Same accent-yellow
 * surface as {@link InitialSetupBar}; shown on every page until the user opens
 * the onboarding page. Hidden on `/onboarding` itself; visibility is decided by
 * the caller.
 *
 * Markup/responsiveness come from the shared {@link AnnouncementBarView}
 * (Figma 9364-40603 / 9418-43969 / 9418-44006, mirrors {@link InitialSetupBar}):
 * one row from `md` up with the CTA at content width, stacked below `md` with
 * the CTA full-width on its own row. The CTA reads "Take the Tour" until the
 * first step is done, then "Continue Onboarding" (`started`). Button matches
 * Figma — `variant="outline" size="small"` (dark card surface, uppercase
 * `text-h5` label) with a leading route glyph.
 *
 * `showAction` (default true) — when false the CTA stays in the DOM but is made
 * `invisible` (non-clickable, non-focusable, still occupies space) so the banner
 * keeps a consistent height on `/onboarding` itself as on every other page.
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
      className="shrink-0 bg-ods-accent text-ods-text-on-accent"
      startAdornment={<CompassIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title="Learn the basics with a quick guided tour."
      actionBlock={
        <Button
          variant="outline"
          size="small"
          leftIcon={<RouteIcon />}
          onClick={onStart}
          aria-hidden={!showAction}
          className={cn(!showAction && 'invisible')}
        >
          {started ? 'Continue Onboarding' : 'Take the Tour'}
        </Button>
      }
    />
  );
}
