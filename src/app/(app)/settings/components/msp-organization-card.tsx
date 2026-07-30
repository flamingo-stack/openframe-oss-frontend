'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';

interface MspOrganizationCardProps {
  name: string;
  website: string;
  logoUrl?: string;
  isLoading?: boolean;
  onEditOrganization: () => void;
}

export function MspOrganizationCard({
  name,
  website,
  logoUrl,
  isLoading,
  onEditOrganization,
}: MspOrganizationCardProps) {
  const displayName = name || 'Your Organization';

  return (
    <div className="flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]" aria-busy={isLoading}>
      {/* The avatar is data-dependent too, so it gets a placeholder rather than being
          left live: with no tenant yet it rendered the initials of the *fallback* name
          ("YO" from "Your Organization") — a plausible-looking wrong value — and then
          swapped to the real logo or initials. `h-12 w-12 rounded-md` is exactly what
          `SquareAvatar size="lg" variant="square"` occupies, so nothing shifts. */}
      {isLoading ? (
        <Skeleton className="h-12 w-12 rounded-md shrink-0" />
      ) : (
        <SquareAvatar src={logoUrl} fallback={displayName} size="lg" variant="square" />
      )}

      <div className="flex-1 min-w-0 overflow-hidden">
        {isLoading ? (
          // Sized off the `text-h4` name it covers — glyph height inside a line box —
          // rather than a picked `h-*`, the same as in `ProfileCardSkeleton`. Only one
          // bar: the website line below is optional per tenant, so reserving it would be
          // a guess. The 48px avatar sets the row height either way.
          <div className="flex items-center h-[var(--font-line-space-h4-body)]">
            <Skeleton className="h-[var(--font-size-h4-body)] w-40 max-w-full rounded-md" />
          </div>
        ) : (
          <>
            <p className="text-h4 text-ods-text-primary truncate" title={displayName}>
              {displayName}
            </p>
            {website && (
              <p className="text-h6 text-ods-text-secondary truncate" title={website}>
                {website}
              </p>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <ResponsiveActionButton
          label="Edit Organization"
          icon={<PenEditIcon className="w-5 h-5 text-ods-text-secondary" />}
          onClick={onEditOrganization}
        />
      </div>
    </div>
  );
}
