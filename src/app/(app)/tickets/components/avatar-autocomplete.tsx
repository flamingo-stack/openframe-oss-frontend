'use client';

import { CheckIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type AutocompleteOption,
  SquareAvatar,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { getFullImageUrl } from '@/lib/image-url';
import type { AvatarOption } from '../hooks/use-ticket-options';

export type AvatarVariant = 'round' | 'square';

export function renderAvatarOption(variant: AvatarVariant) {
  // Named rather than an arrow: `react/display-name` sees any JSX-returning
  // function handed back from here as a component, and an anonymous one has no
  // name to show in a stack trace or the React devtools tree.
  return function AvatarOptionRow(option: AutocompleteOption, isSelected: boolean): ReactNode {
    const { label, imageUrl } = option as AvatarOption;
    return (
      <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xs)]">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
          <SquareAvatar src={getFullImageUrl(imageUrl)} alt={label} fallback={label} size="sm" variant={variant} />
          <div className="min-w-0">
            <TruncateText className="text-inherit">{label}</TruncateText>
          </div>
        </div>
        {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
      </div>
    );
  };
}

export function avatarStartAdornment(option: AvatarOption | undefined, variant: AvatarVariant): ReactNode | undefined {
  if (!option) return undefined;
  return (
    <SquareAvatar
      src={getFullImageUrl(option.imageUrl)}
      alt={option.label}
      fallback={option.label}
      size="sm"
      variant={variant}
    />
  );
}
