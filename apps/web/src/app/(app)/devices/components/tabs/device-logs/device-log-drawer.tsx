'use client';

import { CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { LogDrawer, type LogDrawerInfoField } from '@/app/components/shared/log-drawer';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { formatDateTime } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { deviceLogLevelVariant } from '../../../utils/device-log-level';
import type { DeviceLogEntry } from './device-log-row';

interface DeviceLogDrawerProps {
  /** The line open in the drawer; null closes it. */
  entry: DeviceLogEntry | null;
  onClose: () => void;
  /** The device the tab belongs to — the drawer's device card, as on the Logs page. */
  deviceId: string;
}

function infoFields(entry: DeviceLogEntry): LogDrawerInfoField[] {
  const fields: LogDrawerInfoField[] = [{ label: 'Received', value: entry.timestamp }];
  if (entry.agentTimestamp != null) fields.push({ label: 'Agent Timestamp', value: entry.agentTimestamp });
  if (entry.hostname) fields.push({ label: 'Hostname', value: entry.hostname });
  if (entry.count != null && entry.count > 1) fields.push({ label: 'Occurrences', value: formatCount(entry.count) });
  return fields;
}

/** Device Logs → a line's details, in the Logs page's own "Log Details" drawer. */
export function DeviceLogDrawer({ entry, onClose, deviceId }: DeviceLogDrawerProps) {
  const { copy, copied } = useCopyToClipboard({ successDescription: 'Log line copied' });

  return (
    <LogDrawer
      isOpen={entry !== null}
      onClose={onClose}
      // pre-wrap keeps the message's own line breaks.
      description={entry && <div className="whitespace-pre-wrap break-words">{entry.message}</div>}
      statusTag={entry ? { label: entry.level, variant: deviceLogLevelVariant(entry.level) } : undefined}
      timestamp={entry ? formatDateTime(entry.timestamp) : undefined}
      infoFields={entry ? infoFields(entry) : []}
      deviceId={deviceId}
    >
      {entry && (
        <div>
          <Button
            variant="outline"
            size="small"
            leftIcon={
              copied ? <CheckIcon className="text-ods-success" /> : <Copy02Icon className="text-ods-text-secondary" />
            }
            onClick={() => {
              void copy(entry.message);
            }}
          >
            Copy
          </Button>
        </div>
      )}
    </LogDrawer>
  );
}
