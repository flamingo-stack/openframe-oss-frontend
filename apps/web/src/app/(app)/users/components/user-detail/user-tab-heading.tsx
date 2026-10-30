import type { ReactNode } from 'react';

/**
 * A user-page tab's heading (the title-block instance in Figma 1014:1222 and its tabs): the title sits on the bottom
 * of a 72px block, 32px under the tab bar from `content-md`; a phone's is 68px, 36px under it (1019:35005).
 */
export function UserTabHeading({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex min-h-[4.25rem] items-end justify-between gap-[var(--spacing-system-m)] pt-[var(--spacing-system-xl)] content-md:min-h-[4.5rem] content-md:pt-[var(--spacing-system-l)]">
      <h2 className="min-w-0 truncate text-ods-text-primary text-h2">{title}</h2>
      {actions}
    </div>
  );
}
