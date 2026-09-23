import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceLogLevel } from '@/generated/schema-enums';

export const DEVICE_LOG_LEVELS: readonly DeviceLogLevel[] = [
  DeviceLogLevel.DEBUG,
  DeviceLogLevel.INFO,
  DeviceLogLevel.WARN,
  DeviceLogLevel.ERROR,
];

const KNOWN_LEVELS = new Set<string>(DEVICE_LOG_LEVELS);

/** The API contract: `level` is a free string; anything outside the four is INFO. */
export function normalizeDeviceLogLevel(level: string): DeviceLogLevel {
  const upper = level.trim().toUpperCase();
  return KNOWN_LEVELS.has(upper) ? (upper as DeviceLogLevel) : DeviceLogLevel.INFO;
}

/** Colour AND text per FE-5 — the chip label stays the reported level, only the skin is mapped. */
export function getDeviceLogLevelVariant(level: DeviceLogLevel): NonNullable<TagProps['variant']> {
  switch (level) {
    case DeviceLogLevel.ERROR:
      return 'error';
    case DeviceLogLevel.WARN:
      return 'warning';
    case DeviceLogLevel.DEBUG:
      return 'outline';
    default:
      return 'grey';
  }
}
