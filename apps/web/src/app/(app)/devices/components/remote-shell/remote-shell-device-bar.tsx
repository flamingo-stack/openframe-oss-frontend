'use client';

import { Button, TruncateText } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { TerminalSquareIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';

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

/** The bar while the device is read: the icon tile and the real Disconnect button, the device and status bars. */
function RemoteShellDeviceBarSkeleton() {
  return (
    <div className={BAR_CLASS}>
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0 rounded-md border border-ods-border bg-ods-card p-2">
          <TerminalSquareIcon className="h-4 w-4 text-ods-text-primary" />
        </div>
        <div className="flex min-w-0 flex-col">
          <TextLineSkeleton type="h4" className="w-48" />
          <TextLineSkeleton type="h6" className="w-36" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <TextLineSkeleton type="h6" className="w-20" />
        <Button variant="outline" className={DISCONNECT_CLASS} disabled>
          Disconnect
        </Button>
      </div>
    </div>
  );
}

/** The remote shell's device bar: which device and shell, the tunnel's status and Disconnect. */
export function RemoteShellDeviceBar({
  title,
  subtitle,
  status,
  onDisconnect,
  disconnectDisabled,
}: RemoteShellDeviceBarProps) {
  if (useLoadingScope()) {
    return <RemoteShellDeviceBarSkeleton />;
  }

  return (
    <div className={BAR_CLASS}>
      {/* Device info */}
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0 rounded-md border border-ods-border bg-ods-card p-2">
          <TerminalSquareIcon className="h-4 w-4 text-ods-text-primary" />
        </div>
        <div className="flex min-w-0 flex-col">
          <TruncateText>{title}</TruncateText>
          <TruncateText variant="h6" tone="secondary">
            {subtitle}
          </TruncateText>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-4">
        {status}
        <Button onClick={onDisconnect} variant="outline" className={DISCONNECT_CLASS} disabled={disconnectDisabled}>
          Disconnect
        </Button>
      </div>
    </div>
  );
}
