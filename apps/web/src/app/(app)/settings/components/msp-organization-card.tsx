'use client';

import { LoadingRegion, TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { SquareAvatar, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';

interface MspOrganizationCardProps {
  name: string;
  website: string;
  logoUrl?: string;
  /** The tenant has not answered: the row draws its own skeleton (as it does in a loading scope). */
  loading?: boolean;
  /** Omitted until the org has actually loaded — see `account-settings-card`. */
  onEditOrganization?: () => void;
}

const ROW_CLASS = 'flex items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]';
const EDIT_LABEL = 'Edit Organization';
const editIcon = <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />;

/**
 * The row while the tenant is on its way. The avatar is data-dependent too (with no tenant it would draw the
 * initials of a fallback name, a plausible-looking wrong value), so it is a box of exactly what
 * `SquareAvatar size="lg" variant="square"` occupies. One text bar: the website line is optional per tenant, so
 * reserving it would be a guess; the 48px avatar sets the row height either way. The Edit button is fixed copy,
 * drawn for real and disabled.
 */
export function MspOrganizationCardSkeleton() {
  return (
    <LoadingRegion label="Loading your organization" className={ROW_CLASS}>
      <UnifiedSkeleton className="h-12 w-12 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <TextLineSkeleton type="h4" className="w-40 max-w-full" />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ResponsiveActionButton label={EDIT_LABEL} icon={editIcon} disabled />
      </div>
    </LoadingRegion>
  );
}

export function MspOrganizationCard({ name, website, logoUrl, loading, onEditOrganization }: MspOrganizationCardProps) {
  if (useLoadingScope() || loading) return <MspOrganizationCardSkeleton />;
  const displayName = name || 'Your Organization';

  return (
    <div className={ROW_CLASS}>
      <SquareAvatar src={logoUrl} fallback={displayName} size="lg" variant="square" />

      <div className="min-w-0 flex-1 overflow-hidden">
        <TruncateText>{displayName}</TruncateText>
        {website && (
          <TruncateText variant="h6" tone="secondary">
            {website}
          </TruncateText>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ResponsiveActionButton
          label={EDIT_LABEL}
          icon={editIcon}
          onClick={onEditOrganization}
          disabled={!onEditOrganization}
        />
      </div>
    </div>
  );
}
