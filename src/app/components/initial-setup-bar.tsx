'use client';

import { ListCheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AnnouncementBarView, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/**
 * Full-width banner rendered in the app layout's `topBar` slot (above sidebar +
 * header) while the tenant "Initial Setup" is unfinished. Accent-yellow surface
 * with on-accent (dark) text — see ODS `--color-accent-primary` / `on-accent`.
 * Hidden on the page that hosts the setup card (dashboard); visibility is
 * decided by the caller.
 *
 * Markup/responsiveness come from the shared {@link AnnouncementBarView}
 * (Figma 9364-40603 / 9418-43969 / 9418-44006): one row from `md` up with the
 * CTA at content width, stacked below `md` with the CTA full-width on its own
 * row. The CTA reads "Start Setup" until the first step is done, then
 * "Continue Setup" (`started`). Button uses `variant="outline" size="small"` —
 * a dark card surface with an uppercase Azeret Mono (`text-h5`) label,
 * matching Figma.
 *
 * `showAction` (default true) — when false the CTA stays in the DOM but is made
 * `invisible` (non-clickable, non-focusable, still occupies space) so the banner
 * keeps a consistent height on the page that already hosts the setup card
 * (the dashboard) as on every other page.
 */
export function InitialSetupBar({
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
      startAdornment={<ListCheckIcon className="size-6 shrink-0" />}
      title="Complete your Initial Setup to start using OpenFrame."
      actionBlock={
        <Button
          variant="outline"
          size="small"
          onClick={onStart}
          aria-hidden={!showAction}
          className={cn(!showAction && 'invisible')}
        >
          {started ? 'Continue Setup' : 'Start Setup'}
        </Button>
      }
    />
  );
}
