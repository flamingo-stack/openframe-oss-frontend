import type { ReactNode } from 'react';
import { EmptyState } from '@/app/components/shared/empty-state';

/**
 * Unified empty screen for device detail tabs — the app-wide `EmptyState`
 * wrapper, so the message is vertically centered in the remaining viewport
 * exactly like the list pages (devices, customers, …). Pass the tab's own icon
 * from `device-tabs.tsx` so the empty state matches the tab bar.
 * `buttonLabel`/`onButtonClick` forward to `NoData`'s action button (e.g. a
 * Retry for the fleet-error state).
 */
export function TabEmptyState({
  icon,
  title,
  description,
  buttonLabel,
  onButtonClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      buttonLabel={buttonLabel}
      onButtonClick={onButtonClick}
    />
  );
}
