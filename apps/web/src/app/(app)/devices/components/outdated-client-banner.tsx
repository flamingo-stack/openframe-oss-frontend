'use client';

import { CommandBox } from '@flamingo-stack/openframe-frontend-core/components/features';
import { AlertTriangleIcon, CheckIcon, Copy02Icon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useInstallCommand } from '../hooks/use-install-command';
import type { Device } from '../types/device.types';
import { isClientOutdated } from '../utils/client-version';
import { normalizeDevicePlatform } from '../utils/device-command-utils';
import { isArchiveLifecycle } from '../utils/tool-connection-status';

/**
 * "OpenFrame client is outdated" on the device page, with the install command that updates it.
 * Nothing for a current client or one whose version is unknown, so the install key is fetched
 * only for a device that needs it. Nothing on an archived or deleted record either: the agent
 * re-registers under its saved machine id and the server sets it back to PENDING, which would
 * bring a deleted device back.
 */
export function OutdatedClientBanner({ device }: { device: Device }) {
  if (!device.organizationId || isArchiveLifecycle(device) || !isClientOutdated(device)) return null;
  return (
    <OutdatedClientReinstall
      organizationId={device.organizationId}
      platform={normalizeDevicePlatform(undefined, device.osType)}
    />
  );
}

interface OutdatedClientReinstallProps {
  /** The device's own customer: an install under another one moves the device there. */
  organizationId: string;
  platform: OSPlatformId;
}

function OutdatedClientReinstall({ organizationId, platform }: OutdatedClientReinstallProps) {
  const { toast } = useToast();
  // No tags and no remote access mode: a re-install keeps what the device has, and the server
  // would add a tag the command repeats as a second assignment.
  const { command, initialKey, secretError, rotateMachineId } = useInstallCommand({
    organizationId,
    platform,
    reinstall: true,
  });

  const { copy: copyButtonCommand, copied } = useCopyToClipboard({
    successDescription: 'Command copied to clipboard',
    errorDescription: 'Could not copy command',
  });
  // The corner button has its own hook, so a copy from the box does not tick the main button.
  const { copy: copyBoxCommand } = useCopyToClipboard({
    successDescription: 'Command copied to clipboard',
    errorDescription: 'Could not copy command',
  });

  const copyWith = (copy: (text: string) => Promise<void>) => {
    if (!initialKey) {
      toast({
        title: 'Secret unavailable',
        description: secretError ? 'Registration secret could not be loaded' : 'Registration secret not loaded yet',
        variant: 'destructive',
      });
      return;
    }
    void copy(command);
    // The copied command carries this download id; the one left on screen gets a fresh one.
    rotateMachineId();
  };

  return (
    <div data-loading-optional className="flex flex-col gap-[var(--spacing-system-m)]">
      <Alert
        variant="error"
        role="status"
        className="flex items-start gap-[var(--spacing-system-m)] rounded-[6px] border-ods-error p-[var(--spacing-system-m)]"
      >
        {/* Wrapped: the Alert positions a direct svg child absolutely. */}
        <span className="shrink-0">
          <AlertTriangleIcon className="h-6 w-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-h3">OpenFrame client is outdated</p>
          <p className="text-h6">
            This device runs an old version of the agent. Run the latest install command on this device to update it.
          </p>
        </div>
      </Alert>
      <CommandBox
        title="OpenFrame Installation Script"
        command={command}
        // A failed read is not a pending one: the box then shows the command, which copies nothing without its key.
        loading={!initialKey && !secretError}
        onCopy={() => copyWith(copyBoxCommand)}
        copyAriaLabel="Copy installation script"
        commandClassName="text-ods-accent"
      />
      <Button
        type="button"
        variant="outline"
        size="small"
        className="self-end"
        onClick={() => copyWith(copyButtonCommand)}
        leftIcon={copied ? <CheckIcon className="h-5 w-5 text-ods-success" /> : <Copy02Icon className="h-5 w-5" />}
      >
        Copy Install Command
      </Button>
    </div>
  );
}
