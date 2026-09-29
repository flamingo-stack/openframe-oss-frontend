'use client';

import { useDeviceUptime } from '../hooks/use-device-uptime';

interface DeviceUptimeBadgeProps {
  onlineMinutes: number;
  totalMinutes: number;
  onDetails: () => void;
}

export function DeviceUptimeBadge({ onlineMinutes, totalMinutes, onDetails }: DeviceUptimeBadgeProps) {
  const uptime = useDeviceUptime(onlineMinutes, totalMinutes);
  return (
    <div className="flex items-center gap-[var(--spacing-system-xsf)]">
      <span className="text-h6 text-green-400">{uptime.label}</span>
      <button type="button" onClick={onDetails}>
        Details
      </button>
    </div>
  );
}
