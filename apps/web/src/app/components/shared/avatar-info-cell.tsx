'use client';

import { SquareAvatar } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentProps } from 'react';
import { InfoCell } from './info-cell';

interface AvatarInfoCellProps {
  label: string;
  /** Null or undefined when there is none. */
  person: { name: string; imageUrl?: string } | null | undefined;
  variant: ComponentProps<typeof SquareAvatar>['variant'];
  /** What the cell says when there is none. */
  unset: string;
  loading: boolean;
}

/** An `InfoCell` led by an avatar: a person's or an organization's avatar and name, or what having none means. */
export function AvatarInfoCell({ label, person, variant, unset, loading }: AvatarInfoCellProps) {
  return (
    <InfoCell
      label={label}
      skeletonWidth="w-36"
      icon={
        (loading || person) && (
          <SquareAvatar
            src={person?.imageUrl}
            alt={person?.name}
            fallback={person?.name ?? ''}
            size="xs"
            variant={variant}
          />
        )
      }
      value={loading ? null : (person?.name ?? unset)}
    />
  );
}
