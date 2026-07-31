'use client';

import { DeviceSelector } from './device-selector';
import type { DeviceSelectorProps } from './device-selector.types';

const NO_DEVICES: never[] = [];

// `readOnly` is deliberately NOT accepted: the skeleton hardcodes it, and
// `selectedIds`/`onSelectionChange` are required without it.
type DeviceSelectorSkeletonProps = Pick<DeviceSelectorProps, 'showSelectionModeRadio' | 'singleSelect' | 'hideColumns'>;

/**
 * Suspense fallback for a `DeviceSelector` whose devices come from a suspending
 * Relay query.
 *
 * Renders the REAL selector in `loading` mode rather than an approximation, so
 * the column set, row height and empty frame come from the actual component and
 * can't drift from what replaces it. Same approach as `DevicesPanelSkeleton`.
 */
export function DeviceSelectorSkeleton(props: DeviceSelectorSkeletonProps) {
  return <DeviceSelector {...props} devices={NO_DEVICES} loading readOnly />;
}
