import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceLogLevel } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';

/** Chip order in the toolbar, lowest severity first. */
export const DEVICE_LOG_LEVELS: readonly DeviceLogLevel[] = [
  DeviceLogLevel.DEBUG,
  DeviceLogLevel.INFO,
  DeviceLogLevel.WARN,
  DeviceLogLevel.ERROR,
];

/** Colour AND text per FE-5 — the chip label stays the reported level, only the skin is mapped. */
const DEVICE_LOG_LEVEL_VARIANT: Record<DeviceLogLevel, NonNullable<TagProps['variant']>> = {
  [DeviceLogLevel.DEBUG]: 'outline',
  [DeviceLogLevel.INFO]: 'grey',
  [DeviceLogLevel.WARN]: 'warning',
  [DeviceLogLevel.ERROR]: 'error',
};

export const isDeviceLogLevel = (value: string): value is DeviceLogLevel => knownValue(DeviceLogLevel, value) !== null;

/** The API contract: `level` is a free string; anything outside the four is INFO. */
export function normalizeDeviceLogLevel(level: string): DeviceLogLevel {
  return knownValue(DeviceLogLevel, level.trim().toUpperCase()) ?? DeviceLogLevel.INFO;
}

export function getDeviceLogLevelVariant(level: DeviceLogLevel): NonNullable<TagProps['variant']> {
  return DEVICE_LOG_LEVEL_VARIANT[level];
}
