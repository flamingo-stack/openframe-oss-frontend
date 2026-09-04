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

/**
 * Data tabs while the agent is still deploying: the section is empty because
 * the device is still connecting, not because it genuinely has no data — every
 * tab shares the same design copy, titled by section.
 */
export function TabDeployingEmptyState({ icon, section }: { icon: ReactNode; section: string }) {
  return (
    <TabEmptyState
      icon={icon}
      title={`${section} data unavailable`}
      description="This information will appear once the agent finishes deploying"
    />
  );
}
