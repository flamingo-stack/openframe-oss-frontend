'use client';

import type { ReactNode } from 'react';
import { useDeviceDetails } from '@/app/(app)/devices/hooks/use-device-details';
import { DeviceSummaryCard } from './device-summary-card';

function LogDrawerDeviceCard({ deviceId, onNavigate }: { deviceId: string; onNavigate: () => void }) {
  const { deviceDetails, isLoading } = useDeviceDetails(deviceId, { polling: false });

  if (!isLoading && !deviceDetails) return null;

  return <DeviceSummaryCard device={deviceDetails} deviceId={deviceId} loading={isLoading} onNavigate={onNavigate} />;
}

/**
 * The `deviceCard` of the lib's `LogDrawer` for a log's device: the card the
 * drawer pins to its bottom, or nothing for a log with no device (system events
 * carry the literal "null").
 *
 * `onNavigate` is the drawer's close: the card's Details button targets a
 * `?id=` detail URL, so on the device page itself the click changes nothing on
 * screen and reads as broken unless the drawer gets out of the way.
 */
export function logDrawerDeviceCard(deviceId: string | undefined, onNavigate: () => void): ReactNode {
  if (!deviceId || deviceId === 'null') return undefined;
  return <LogDrawerDeviceCard deviceId={deviceId} onNavigate={onNavigate} />;
}
