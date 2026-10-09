'use client';

import {
  CheckCircleIcon,
  Chevron01DownIcon,
  Copy01Icon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn, type OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef, useState } from 'react';
import { useDeviceOrganizations } from '@/app/(app)/devices/hooks/use-device-organizations';
import { useInstallCommand } from '@/app/(app)/devices/hooks/use-install-command';
import { OsPlatformSelector } from '@/app/components/shared/os-platform-selector';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '@/lib/platforms';
import { SetupHeading } from '../components/setup-heading';
import { type FirstDevice, useFirstDeviceEnrollment } from '../hooks/use-first-device-enrollment';

/** How long the finished checklist stays up before the wizard moves on. */
const ADVANCE_DELAY_MS = 1_200;

/** The platform the admin is most likely enrolling first: the one they are on. */
function detectPlatform(): OSPlatformId {
  if (typeof navigator === 'undefined') return 'windows';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? 'darwin' : 'windows';
}

/**
 * The checklist's lines, oldest first. "Workspace resolved" has no server
 * signal - the agent resolves the tenant before it registers - so it is the
 * command having been handed over; the rest are the machine's own stages.
 */
function checklistLines(handedOver: boolean, device: FirstDevice | null): string[] {
  const lines: string[] = [];
  if (handedOver || device) lines.push('workspace resolved');
  if (device) lines.push('device enrolled');
  if (device?.stages.inventoryReceived) lines.push('inventory received');
  if (device?.stages.aiReady) lines.push('mingo unlocked');
  return lines;
}

/**
 * "Deploy First Device": the install command for the customer created a step
 * earlier (else the default organization), and under it the enrollment
 * checklist that fills in as the agent comes up. Done when the assistant is
 * live on the machine - the wizard then shows "You are ready to go".
 *
 * "Deploy on this Device" is absent until the desktop shell can run the
 * installer locally; the web has nothing to run it with.
 */
export function DeployDeviceStep({
  organizationId,
  onEnrolled,
}: {
  /** The customer created on the previous screen; null = use the default organization. */
  organizationId: string | null;
  /** The first device is fully enrolled; persist the step and move on. */
  onEnrolled: (device: FirstDevice) => void;
}) {
  const { toast } = useToast();
  const organizations = useDeviceOrganizations(100);
  const effectiveOrganizationId =
    organizationId ??
    organizations.find(organization => !organization.isDefault)?.organizationId ??
    organizations.find(organization => organization.isDefault)?.organizationId ??
    organizations[0]?.organizationId ??
    '';

  const [platform, setPlatform] = useState<OSPlatformId>(detectPlatform);
  const [expanded, setExpanded] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const { command, initialKey } = useInstallCommand({ organizationId: effectiveOrganizationId, platform });
  const { copy } = useCopyToClipboard({
    successDescription: 'Installer command copied to clipboard',
    errorDescription: 'Could not copy command',
  });

  const device = useFirstDeviceEnrollment(true);
  const lines = checklistLines(handedOver, device);
  const enrolled = device?.stages.aiReady ?? false;

  // Hand over once: the effect re-runs on every poll, the callback must not.
  const handedOffRef = useRef(false);
  useEffect(() => {
    if (!enrolled || !device || handedOffRef.current) return undefined;
    handedOffRef.current = true;
    const timer = setTimeout(() => onEnrolled(device), ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enrolled, device, onEnrolled]);

  const handleCopy = () => {
    if (!effectiveOrganizationId) {
      toast({ title: 'No customer', description: 'Add a customer before enrolling a device', variant: 'destructive' });
      return;
    }
    if (!initialKey) {
      toast({ title: 'Secret unavailable', description: 'Registration secret not loaded yet', variant: 'destructive' });
      return;
    }
    trackDashboardActivity(EVENT_SUBTYPE.ADD_DEVICE);
    void copy(command);
    setHandedOver(true);
  };

  return (
    <>
      <SetupHeading
        title="Deploy First Device"
        subtitle="Run one command on a machine to connect it to OpenFrame and start monitoring."
      />
      <div className="flex w-full flex-col gap-[var(--spacing-system-m)]">
        <OsPlatformSelector
          value={platform}
          onValueChange={setPlatform}
          disabledPlatforms={DISABLED_PLATFORMS}
          options={AVAILABLE_PLATFORMS.map(option => ({ platformId: option.id }))}
        />
        <div className="flex w-full items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]">
          <p className={cn('min-w-0 flex-1 text-ods-text-primary text-code', expanded ? 'break-all' : 'truncate')}>
            {command}
          </p>
          <button
            type="button"
            aria-label={expanded ? 'Collapse command' : 'Show the whole command'}
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
            className="shrink-0 text-ods-text-secondary transition-colors hover:text-ods-text-primary"
          >
            <Chevron01DownIcon className={cn('size-5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-[var(--spacing-system-xs)]">
          <Button variant="accent" leftIcon={<Copy01Icon />} onClick={handleCopy} className="w-full">
            Copy Command
          </Button>
          <p className="text-ods-text-secondary text-h6">Deployment may take 2-3 minutes to install all agents</p>
        </div>
      </div>
      {lines.length > 0 && (
        <ol className="flex flex-col items-center gap-[var(--spacing-system-xxs)]" aria-label="Deployment progress">
          {/* Newest on top: the list grows upwards as the agent reports in. */}
          {[...lines].reverse().map(line => (
            <li
              key={line}
              className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-secondary text-h6"
            >
              <CheckCircleIcon className="size-4 text-ods-success" />
              {line}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
