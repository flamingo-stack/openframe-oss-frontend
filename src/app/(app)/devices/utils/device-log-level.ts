import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { DeviceLogLevel } from '@/generated/schema-enums';

/** Chip order, lowest severity first. */
export const DEVICE_LOG_LEVELS: readonly DeviceLogLevel[] = [
  DeviceLogLevel.DEBUG,
  DeviceLogLevel.INFO,
  DeviceLogLevel.WARN,
  DeviceLogLevel.ERROR,
];

const LEVEL_VARIANT: Record<DeviceLogLevel, NonNullable<TagProps['variant']>> = {
  [DeviceLogLevel.DEBUG]: 'outline',
  [DeviceLogLevel.INFO]: 'grey',
  [DeviceLogLevel.WARN]: 'warning',
  [DeviceLogLevel.ERROR]: 'error',
};

export const isDeviceLogLevel = (value: string): value is DeviceLogLevel => Object.hasOwn(LEVEL_VARIANT, value);

/** `DeviceLogEntry.level` is a free string; anything outside the enum draws as INFO. */
export function deviceLogLevelVariant(level: string): NonNullable<TagProps['variant']> {
  const upper = level.trim().toUpperCase();
  return isDeviceLogLevel(upper) ? LEVEL_VARIANT[upper] : LEVEL_VARIANT[DeviceLogLevel.INFO];
}
