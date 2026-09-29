export interface DeviceUptime {
  percent: number;
  label: string;
}

export function useDeviceUptime(onlineMinutes: number, totalMinutes: number): DeviceUptime {
  const percent = Math.round((totalMinutes / onlineMinutes) * 100);
  return { percent, label: `${percent}% uptime` };
}
