'use client';

import { Chevron02RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface SettingMenuItemProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  /** Inline stamp after the title, e.g. a "Beta" `Tag` (Figma 2097-117139). */
  badge?: ReactNode;
}

// Shared so the loading card below can't drift from the card it stands in for. The two
// frames are what set the card's height, and neither carries a height class: each is
// `sf` padding + a 24px glyph + its own 1px border = 50px. With the shell's `m` padding
// and border that makes the card 84px on desktop and 76px below md.
const CARD_SHELL_CLASSES =
  'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex gap-[var(--spacing-system-s)] items-center';
const ICON_FRAME_CLASSES =
  'shrink-0 rounded bg-ods-bg border border-ods-border flex items-center justify-center text-ods-text-secondary p-[var(--spacing-system-sf)]';
const CHEVRON_FRAME_CLASSES = 'shrink-0 bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-sf)]';

/**
 * The card while the grid's gates (a feature flag, a role) have not answered which cards it holds. Everything on a
 * card is fixed copy, so it is drawn for real; only the link is left out, since the card may not be one this
 * workspace keeps. Same frames as the card, so the slot is exactly its size.
 */
export function SettingMenuItemSkeleton({ icon, title, description, badge }: Omit<SettingMenuItemProps, 'href'>) {
  return (
    <div className={CARD_SHELL_CLASSES}>
      <div className={ICON_FRAME_CLASSES}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className="text-ods-text-primary text-h3">{title}</p>
          {badge}
        </div>
        <p className="text-ods-text-secondary text-h6">{description}</p>
      </div>
      <div className={CHEVRON_FRAME_CLASSES}>
        <Chevron02RightIcon className="size-6 text-ods-text-secondary" />
      </div>
    </div>
  );
}

export function SettingMenuItem({ href, icon, title, description, badge }: SettingMenuItemProps) {
  if (useLoadingScope())
    return <SettingMenuItemSkeleton icon={icon} title={title} description={description} badge={badge} />;
  return (
    <div className={CARD_SHELL_CLASSES}>
      <div className={ICON_FRAME_CLASSES}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className="text-ods-text-primary text-h3">{title}</p>
          {badge}
        </div>
        <p className="text-ods-text-secondary text-h6">{description}</p>
      </div>
      <Link
        href={href}
        aria-label={title}
        className={cn(CHEVRON_FRAME_CLASSES, 'transition-colors hover:bg-ods-bg-hover')}
      >
        <Chevron02RightIcon className="size-6 text-ods-text-primary" />
      </Link>
    </div>
  );
}
