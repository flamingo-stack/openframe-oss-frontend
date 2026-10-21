'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { TerminalSquareIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { DeviceIdentity } from '../device-identity';

const BAR_CLASS =
  'mb-2 flex flex-shrink-0 items-center justify-between rounded-md border border-ods-border bg-ods-card px-4 py-2';
const DISCONNECT_CLASS = 'border border-ods-border bg-ods-card text-ods-text-primary';

interface RemoteShellDeviceBarProps {
  title: string;
  subtitle: string;
  /** The tunnel's state, already coloured by the page. */
  status: ReactNode;
  onDisconnect: () => void;
  disconnectDisabled: boolean;
}

/**
 * The remote shell's device bar: which device and shell, the tunnel's status and Disconnect. In the page's loading
 * scope the device and the status are bars and Disconnect is inert.
 */
export function RemoteShellDeviceBar({
  title,
  subtitle,
  status,
  onDisconnect,
  disconnectDisabled,
}: RemoteShellDeviceBarProps) {
  const loading = useLoadingScope();
  return (
    <div className={BAR_CLASS}>
      <DeviceIdentity
        className="gap-4"
        icon={
          <div className="shrink-0 rounded-md border border-ods-border bg-ods-card p-2">
            <TerminalSquareIcon className="h-4 w-4 text-ods-text-primary" />
          </div>
        }
        title={title}
        subtitle={subtitle}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        {loading ? <TextLineSkeleton type="h6" className="w-20" /> : status}
        <Button
          onClick={onDisconnect}
          variant="outline"
          className={DISCONNECT_CLASS}
          disabled={loading || disconnectDisabled}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );
}
