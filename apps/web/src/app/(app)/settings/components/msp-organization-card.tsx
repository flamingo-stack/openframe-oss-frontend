'use client';

import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { ResponsiveActionButton } from '@/app/components/shared/responsive-action-button';
import { IdentityRow, USER_ROW_CLASS } from './identity-row';

interface MspOrganizationCardProps {
  name: string;
  website: string;
  logoUrl?: string;
  /** The tenant has not answered: the row draws its values as bars (as it does in a loading scope). */
  loading?: boolean;
  /** Omitted until the org has actually loaded — see `account-settings-card`. */
  onEditOrganization?: () => void;
}

const editIcon = <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />;

/**
 * The organization row. While the tenant is on its way the avatar is a box of exactly what
 * `SquareAvatar size="lg" variant="square"` occupies (with no tenant it would draw the initials of a fallback name, a
 * plausible-looking wrong value) and the name a bar. No website bar: the website line is optional per tenant, so
 * reserving it would be a guess; the 48px avatar sets the row height either way. The Edit button is fixed copy, drawn
 * for real and disabled until there is an organization to edit.
 */
export function MspOrganizationCard({ name, website, logoUrl, loading, onEditOrganization }: MspOrganizationCardProps) {
  return (
    <IdentityRow
      className={USER_ROW_CLASS}
      loading={loading}
      loadingLabel="Loading your organization"
      name={name || 'Your Organization'}
      avatarSrc={logoUrl}
      avatarVariant="square"
      subline={website}
      action={
        <ResponsiveActionButton
          label="Edit Organization"
          icon={editIcon}
          onClick={onEditOrganization}
          disabled={!onEditOrganization}
        />
      }
    />
  );
}
