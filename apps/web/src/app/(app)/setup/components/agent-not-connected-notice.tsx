'use client';

import {
  AlertTriangleIcon,
  Copy02Icon,
  HeadphoneIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { ContactSupportModal } from '@/app/components/shared/contact-support-modal';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { CommandBox } from './command-box';

/**
 * Where the OpenFrame client writes its logs, per OS: the client's defaults
 * (`get_logs_directory`, openframe-oss-lib clients/openframe-client/src/platform/directories.rs).
 * An install with `OPENFRAME_LOG_DIR` set writes elsewhere, and `%ProgramData%`
 * is not on `C:` on every machine; support knows both.
 */
export const CLIENT_LOGS_PATHS: Record<OSPlatformId, string> = {
  windows: 'C:\\ProgramData\\OpenFrame\\logs',
  darwin: '/Library/Logs/OpenFrame',
  linux: '/var/log/openframe',
};

/**
 * Deploy First Device, when the agent has not reached the platform in time:
 * what most likely stopped it, the logs folder to zip for the selected OS, and
 * a way to support. Nothing here stops the wait: the step keeps polling and
 * moves on as before when the agent connects.
 *
 * The logs folder sits in the step's command box, not the lib's `PathsDisplay`:
 * the design draws it as the command field's twin (card ground, the same
 * padding), and `PathsDisplay` paints the page ground at a fixed, larger size.
 */
export function AgentNotConnectedNotice({ platform }: { platform: OSPlatformId }) {
  const [supportOpen, setSupportOpen] = useState(false);
  const { copy } = useCopyToClipboard({
    successTitle: 'Path copied',
    successDescription: 'Logs folder path copied to clipboard',
    errorTitle: 'Copy failed',
    errorDescription: 'Could not copy path',
  });
  const logsPath = CLIENT_LOGS_PATHS[platform];

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-m)]">
      <Alert
        variant="warning"
        className="flex items-center gap-[var(--spacing-system-m)] rounded-md border-ods-warning-tint-border bg-ods-warning-tint p-[var(--spacing-system-m)] text-ods-warning-tint-text"
      >
        {/* In a span: the Alert positions a bare svg child absolutely, for its own layout. */}
        <span className="shrink-0">
          <AlertTriangleIcon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-h3">Your device hasn&apos;t connected yet</p>
          <p className="text-h6">
            The installer finished, but the device didn&apos;t reach OpenFrame. This is usually caused by antivirus,
            firewall, proxy or a network policy on that machine. Zip the client logs folder and send it to our support
            team — we&apos;ll help you finish the setup.
          </p>
        </div>
      </Alert>
      <div className="flex w-full flex-col gap-[var(--spacing-system-xsf)]">
        <p className="text-ods-text-secondary text-h6">
          Client logs folder — zip it and attach to your support request
        </p>
        <CommandBox className="items-center">
          <p className="min-w-0 flex-1 truncate text-ods-text-primary text-code">{logsPath}</p>
          <button
            type="button"
            aria-label={`Copy ${logsPath}`}
            onClick={() => void copy(logsPath)}
            className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
          >
            <Copy02Icon className="size-5" />
          </button>
        </CommandBox>
      </div>
      <Button variant="outline" leftIcon={<HeadphoneIcon />} onClick={() => setSupportOpen(true)}>
        Contact Support
      </Button>
      <ContactSupportModal open={supportOpen} onOpenChange={setSupportOpen} cancelLabel="Cancel" />
    </div>
  );
}
