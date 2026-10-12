'use client';

import { AppStoreIcon, GooglePlayIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { mobilePlatform } from '@/lib/platform';

/**
 * Where the update button leads, and the one reassurance users look for before
 * updating: it does not sign them out — the tokens live in the Keychain /
 * Keystore, which an app update keeps. Informational, not a second button.
 */
export function StoreUpdateRow() {
  const isAndroid = mobilePlatform() === 'android';
  const StoreIcon = isAndroid ? GooglePlayIcon : AppStoreIcon;

  return (
    <div className="flex items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-ods-border bg-ods-bg">
        <StoreIcon className="size-6 text-ods-text-secondary" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-ods-text-primary text-h3">
          Free update on {isAndroid ? 'Google Play' : 'the App Store'}
        </span>
        <span className="text-ods-text-secondary text-h6">You&apos;ll stay signed in after updating</span>
      </span>
    </div>
  );
}
