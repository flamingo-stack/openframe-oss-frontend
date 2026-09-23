import { readInlineData } from 'react-relay';
import type { deviceLogFields_entry$key } from '@/__generated__/deviceLogFields_entry.graphql';
import { deviceLogFieldsFragment } from '@/graphql/devices/device-log-fields';
import type { UiDeviceLog } from '../types/device-log.types';
import { toRepeatCount } from './device-log-count';
import { normalizeDeviceLogLevel } from './device-log-level';

export function toUiDeviceLog(cursor: string, ref: deviceLogFields_entry$key): UiDeviceLog {
  const node = readInlineData(deviceLogFieldsFragment, ref);
  return {
    key: cursor,
    timestamp: String(node.timestamp),
    agentTimestamp: node.agentTimestamp == null ? null : String(node.agentTimestamp),
    level: normalizeDeviceLogLevel(node.level),
    rawLevel: node.level,
    message: node.message,
    hostname: node.hostname ?? null,
    count: toRepeatCount(node.count),
  };
}
