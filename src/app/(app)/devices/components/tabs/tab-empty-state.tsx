import { NoData } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';

/**
 * Unified empty screen for device detail tabs — the same wrapper + `NoData`
 * padding that `DataTable.Body` renders for empty tables, so content tabs
 * (hardware, network, OS, …) are pixel-identical to the table tabs.
 * Pass the tab's own icon from `device-tabs.tsx` so the empty state matches
 * the tab bar. `buttonLabel`/`onButtonClick` forward to `NoData`'s action
 * button (e.g. a Retry for the fleet-error state).
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
    <div className="flex w-full flex-col gap-[var(--spacing-system-xsf)]">
      <NoData
        icon={icon}
        title={title}
        description={description}
        buttonLabel={buttonLabel}
        onButtonClick={onButtonClick}
        className="py-[var(--spacing-system-xxl)]"
      />
    </div>
  );
}
