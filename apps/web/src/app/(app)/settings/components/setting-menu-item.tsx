'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
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
  /** One card of a read list (the help center's legal documents): marked for the height gate in both forms. */
  listItem?: boolean;
}

// The two frames are what set the card's height, and neither carries a height class: each is `sf` padding + a 24px
// glyph + its own 1px border = 50px. With the shell's `m` padding and border that makes the card 84px on desktop and
// 76px below md, loading or loaded.
const CARD_SHELL_CLASSES =
  'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex gap-[var(--spacing-system-s)] items-center';
const ICON_FRAME_CLASSES =
  'shrink-0 rounded bg-ods-bg border border-ods-border flex items-center justify-center text-ods-text-secondary p-[var(--spacing-system-sf)]';
const CHEVRON_FRAME_CLASSES = 'shrink-0 bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-sf)]';

/**
 * One settings card. In a loading scope (the grid's gates, a feature flag or a role, have not answered which cards it
 * holds) the card's fixed copy is drawn for real; a title or description still to be read (`''`, a read list's card) is
 * a text bar of its line. Only the link is left out, since the card may not be one this workspace keeps.
 */
export function SettingMenuItem({ href, icon, title, description, badge, listItem }: SettingMenuItemProps) {
  const loading = useLoadingScope();
  return (
    <div className={CARD_SHELL_CLASSES} data-loading-item={listItem || undefined}>
      <div className={ICON_FRAME_CLASSES}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          {loading && !title ? (
            <TextLineSkeleton type="h3" className="w-2/5" />
          ) : (
            <p className="text-ods-text-primary text-h3">{title}</p>
          )}
          {badge}
        </div>
        {loading && !description ? (
          <TextLineSkeleton type="h6" className="w-3/4" />
        ) : (
          <p className="text-ods-text-secondary text-h6">{description}</p>
        )}
      </div>
      {loading ? (
        <div className={CHEVRON_FRAME_CLASSES}>
          <Chevron02RightIcon className="size-6 text-ods-text-secondary" />
        </div>
      ) : (
        <Link
          href={href}
          aria-label={title}
          className={cn(CHEVRON_FRAME_CLASSES, 'transition-colors hover:bg-ods-bg-hover')}
        >
          <Chevron02RightIcon className="size-6 text-ods-text-primary" />
        </Link>
      )}
    </div>
  );
}
