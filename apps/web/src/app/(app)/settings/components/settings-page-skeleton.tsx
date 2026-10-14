'use client';

import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * Route-level skeleton for `/settings` — `SettingsHub`'s account card, the
 * navigation-card grid and the Log Out button. Only the user-dependent content
 * is a placeholder; the layout matches the loaded hub so nothing shifts.
 */

const MENU_CARD_KEYS = ['billing', 'ai', 'architecture', 'employees', 'api-keys', 'sso', 'download-apps'] as const;

export function SettingsPageSkeleton() {
  return (
    <PageLayout
      title="Settings"
      className="min-h-full px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      contentClassName="gap-[var(--spacing-system-l)] content-lg:gap-[var(--spacing-system-xl)]"
    >
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <UnifiedSkeleton className="h-40 w-full rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] content-md:grid-cols-2">
        {MENU_CARD_KEYS.map(key => (
          <UnifiedSkeleton key={key} className="h-[88px] w-full rounded-md" />
        ))}
      </div>

      <div className="mt-auto">
        <UnifiedSkeleton className="h-12 w-32 rounded-md" />
      </div>
    </PageLayout>
  );
}
