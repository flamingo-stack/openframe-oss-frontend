'use client';

import {
  AppStoreIcon,
  CheckCircleIcon,
  GooglePlayIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';
import { mobilePlatform } from '@/lib/platform';

/** Informational, not a second button: where the update comes from, and what it keeps. */
function UpdateRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-ods-border bg-ods-bg">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-ods-text-primary text-h3">{title}</span>
        <span className="text-ods-text-secondary text-h6">{detail}</span>
      </span>
    </div>
  );
}

/**
 * Where the update button leads, and the one reassurance users look for before
 * updating: it does not sign them out — the tokens live in the Keychain /
 * Keystore, which an app update keeps.
 */
export function StoreUpdateRow() {
  const isAndroid = mobilePlatform() === 'android';
  const StoreIcon = isAndroid ? GooglePlayIcon : AppStoreIcon;

  return (
    <UpdateRow
      icon={<StoreIcon className="size-6 text-ods-text-secondary" aria-hidden />}
      title={`Free update on ${isAndroid ? 'Google Play' : 'the App Store'}`}
      detail="You'll stay signed in after updating"
    />
  );
}

/**
 * The same row for an update the app has already downloaded (`NativeUpdate`'s
 * pending bundle): no store involved, and a restart of the web view keeps the
 * session as a store update does.
 */
export function DownloadedUpdateRow() {
  return (
    <UpdateRow
      icon={<CheckCircleIcon className="size-6 text-ods-text-secondary" aria-hidden />}
      title="Update downloaded"
      detail="You'll stay signed in after restarting"
    />
  );
}
