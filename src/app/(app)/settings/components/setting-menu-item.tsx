'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface SettingMenuItemProps {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}

// Shared so the placeholder below can't drift from the card it stands in for. The two
// frames are what set the card's height, and neither carries a height class: each is
// `sf` padding + a 24px glyph + its own 1px border = 50px. With the shell's `m` padding
// and border that makes the card 84px on desktop and 76px below md — so the placeholder
// reproduces the frames rather than approximating them with a sized block (an `h-12`
// stand-in came out 48px, and the card 2px short at both breakpoints).
const CARD_SHELL_CLASSES =
  'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex gap-[var(--spacing-system-s)] items-center';
const ICON_FRAME_CLASSES =
  'shrink-0 rounded bg-ods-bg border border-ods-border flex items-center justify-center text-ods-text-secondary p-[var(--spacing-system-sf)]';
const CHEVRON_FRAME_CLASSES = 'shrink-0 bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-sf)]';

/**
 * Holds a grid slot for a card whose visibility isn't known yet — a feature flag or a
 * role that hasn't answered. Chrome (both frames) is drawn for real; only the glyphs and
 * the text are placeholders, so the slot is exactly the size of whatever lands in it.
 */
export function SettingMenuItemSkeleton() {
  return (
    <div className={CARD_SHELL_CLASSES} aria-busy="true">
      <div className={ICON_FRAME_CLASSES}>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      {/* Each bar sits in a box the height of the line it replaces (`text-h3` title,
          `text-h6` description) but is only as tall as the glyphs themselves. Filling the
          whole line box made the two bars touch and read as one slab; leading is what
          separates real text, so the placeholder borrows it — and the block still totals
          exactly what the two `<p>`s do. */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center h-[var(--font-line-space-h3-body)]">
          <Skeleton className="h-[var(--font-size-h3-body)] w-32 max-w-full rounded-md" />
        </div>
        <div className="flex items-center h-[var(--font-line-space-h6-caption)]">
          <Skeleton className="h-[var(--font-size-h6-caption)] w-56 max-w-full rounded-md" />
        </div>
      </div>
      <div className={CHEVRON_FRAME_CLASSES}>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}

export function SettingMenuItem({ href, icon, title, description }: SettingMenuItemProps) {
  return (
    <div className={CARD_SHELL_CLASSES}>
      <div className={ICON_FRAME_CLASSES}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-h3 text-ods-text-primary">{title}</p>
        <p className="text-h6 text-ods-text-secondary">{description}</p>
      </div>
      <Link
        href={href}
        aria-label={title}
        className={cn(CHEVRON_FRAME_CLASSES, 'transition-colors hover:bg-ods-bg-hover')}
      >
        <ChevronRight className="size-6 text-ods-text-primary" />
      </Link>
    </div>
  );
}
