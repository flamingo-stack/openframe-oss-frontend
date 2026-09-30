import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceLogLevel } from '@/generated/schema-enums';

type TagVariant = NonNullable<TagProps['variant']>;

/** Chip order, lowest severity first. */
export const DEVICE_LOG_LEVELS: readonly DeviceLogLevel[] = [
  DeviceLogLevel.DEBUG,
  DeviceLogLevel.INFO,
  DeviceLogLevel.WARN,
  DeviceLogLevel.ERROR,
];

const LEVEL_VARIANT: Record<DeviceLogLevel, TagVariant> = {
  [DeviceLogLevel.DEBUG]: 'outline',
  [DeviceLogLevel.INFO]: 'grey',
  [DeviceLogLevel.WARN]: 'warning',
  [DeviceLogLevel.ERROR]: 'error',
};

export function isDeviceLogLevel(value: string): value is DeviceLogLevel {
  return Object.hasOwn(LEVEL_VARIANT, value);
}

/** `DeviceLogEntry.level` is a free string, in any case; anything outside the enum reads as INFO. */
export function normalizeDeviceLogLevel(level: string): DeviceLogLevel {
  const upper = level.trim().toUpperCase();
  return isDeviceLogLevel(upper) ? upper : DeviceLogLevel.INFO;
}

export function deviceLogLevelVariant(level: string): TagVariant {
  return LEVEL_VARIANT[normalizeDeviceLogLevel(level)];
}
