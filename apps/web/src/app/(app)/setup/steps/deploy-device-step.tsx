'use client';

import { LoadingSuspense, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import {
  CheckCircleIcon,
  Chevron01DownIcon,
  Copy01Icon,
  DotsLoaderIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn, type OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useRef, useState } from 'react';
import { useDeviceOrganizations } from '@/app/(app)/devices/hooks/use-device-organizations';
import { useInstallCommand } from '@/app/(app)/devices/hooks/use-install-command';
import { noop } from '@/app/components/shared/no-next-page';
import { OsPlatformSelector } from '@/app/components/shared/os-platform-selector';
import { useCopyToClipboard } from '@/app/hooks/use-copy-to-clipboard';
import { useNow } from '@/app/hooks/use-now';
import { EVENT_SUBTYPE, trackDashboardActivity } from '@/lib/analytics';
import { type AgentInstallError, canInstallAgentLocally } from '@/lib/native-shell';
import { AVAILABLE_PLATFORMS, DISABLED_PLATFORMS } from '@/lib/platforms';
import { AgentNotConnectedNotice } from '../components/agent-not-connected-notice';
import { InstallLog } from '../components/install-log';
import { SetupHeading } from '../components/setup-heading';
import { StepCommandField } from '../components/step-command-field';
import { type FirstDevice, useFirstDeviceEnrollment } from '../hooks/use-first-device-enrollment';
import { useLocalAgentInstall } from '../hooks/use-local-agent-install';

/** The column the step's controls stack in, at the design's 600px. */
const BODY_CLASS = 'flex w-full max-w-[600px] flex-col gap-[var(--spacing-system-m)]';
const PLATFORM_OPTIONS = AVAILABLE_PLATFORMS.map(option => ({ platformId: option.id }));

/**
 * How long the step waits for the agent to reach the platform before it says
 * something is wrong: well past the 2-3 minutes an install takes, far short of
 * the 20+ minute silent hang a blocked agent caused. Pending the client team's
 * confirmation (CU-17tkuw650zm).
 */
export const AGENT_CONNECT_TIMEOUT_MS = 10 * 60_000;
/** How often the deadline is checked against the clock. */
const DEADLINE_TICK_MS = 5_000;

const HINT_USUAL = 'Deployment may take 2-3 minutes to install all agents';
const HINT_LONGER = 'This is taking longer than usual. Still waiting for the device to connect…';

/** The platform the admin is most likely enrolling first: the one they are on. */
function detectPlatform(): OSPlatformId {
  if (typeof navigator === 'undefined') return 'windows';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? 'darwin' : 'windows';
}

/**
 * The checklist's lines, oldest first. "Workspace found" has no server
 * signal - the agent resolves the tenant before it registers - so it is the
 * command having been handed over; the rest are the machine's own stages.
 */
function checklistLines(handedOver: boolean, device: FirstDevice | null): string[] {
  const lines: string[] = [];
  if (handedOver || device) lines.push('Workspace found');
  if (device) lines.push('Device registered');
  if (device?.stages.inventoryReceived) lines.push('Inventory received');
  if (device?.stages.aiReady) lines.push('Mingo unlocked');
  return lines;
}

/** The earlier of two moments, either of which may not have happened. */
function earliest(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

/** The toast for a local install that did not go through. */
function installFailureCopy(error: AgentInstallError | null): { title: string; description: string } {
  switch (error?.kind) {
    case 'cancelled':
      return {
        title: 'Deployment cancelled',
        description: 'Confirm the install and approve the administrator prompt to deploy on this device.',
      };
    case 'busy':
      return { title: 'Deployment already running', description: 'Wait for the current one to finish.' };
    case 'failed':
      return { title: 'Deployment failed', description: 'The installer reported a problem - see its output below.' };
    default:
      return { title: 'Deployment failed', description: error?.message ?? 'The installer could not be started.' };
  }
}

interface DeployDeviceStepProps {
  /** The customer created on the previous screen; null = use the default organization. */
  organizationId: string | null;
  /** "Continue" with the first device fully enrolled: persist the step and move on. */
  onContinue: (device: FirstDevice) => void;
  /** The step is being persisted after "Continue". */
  persisting: boolean;
}

/**
 * What stands beside "Copy Command": nothing while the web waits for its first
 * device, "Deploy on this Device" in the desktop shell until a run goes
 * through, then "Continue".
 */
type PrimaryAction = 'none' | 'deploy' | 'continue';

/**
 * "Deploy First Device": the install command for the customer created a step
 * earlier (else the default organization), and under it the enrollment
 * checklist that fills in as the agent comes up. The admin moves on with
 * "Continue", live once the assistant is up on the machine; nothing moves on
 * by itself.
 *
 * In the desktop shell "Deploy on this Device" runs that same install on this
 * machine behind the OS's administrator prompt and shows what the installer
 * prints; once it has installed, "Continue" takes its place, and a failed run
 * offers it again. The web and the phone have nothing to run it with
 * (`canInstallAgentLocally`) and offer the copy alone, "Continue" joining it
 * when the device is up.
 *
 * The step waits for its own reads: the organizations and the enrollment both
 * suspend on first read, and without a boundary here the wait reached the
 * page's, whose fallback is the welcome screen.
 */
export function DeployDeviceStep(props: DeployDeviceStepProps) {
  return (
    <>
      <SetupHeading
        title="Deploy First Device"
        subtitle="Run one command on a machine to connect it to OpenFrame and start monitoring."
      />
      <DeployDeviceSection {...props} />
    </>
  );
}

/** The step's body, with its own boundary: in its scope the reader draws its own loading form. */
function DeployDeviceSection(props: DeployDeviceStepProps) {
  return (
    // `contents`: the loading region must not become a box of its own in the frame's column.
    <LoadingSuspense label="Loading the install command" className="contents">
      <DeployDeviceBody {...props} />
    </LoadingSuspense>
  );
}

/** In a loading scope (its boundary's fallback) the body draws its loading form and reads nothing. */
function DeployDeviceBody(props: DeployDeviceStepProps) {
  if (useLoadingScope()) return <DeployDeviceLoading />;
  return <DeployDeviceForm {...props} />;
}

/** The controls under the command, and the line under them; the loading form draws them inert. */
function DeployActions({
  primary,
  canDeployHere,
  deploying,
  continueReady,
  continuing,
  hint,
  onCopy,
  onDeploy,
  onContinue,
}: {
  primary: PrimaryAction;
  canDeployHere: boolean;
  /** The local install is running: "Deploy on this Device" waits on it. */
  deploying: boolean;
  /** The assistant is up on the device: "Continue" stops waiting. */
  continueReady: boolean;
  /** "Continue" was pressed and the step is being persisted. */
  continuing: boolean;
  /** The line under the controls: the usual install time, or that it is taking longer. */
  hint: string;
  onCopy: () => void;
  onDeploy: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-[var(--spacing-system-xs)]">
      {primary === 'none' ? (
        <Button variant="accent" leftIcon={<Copy01Icon />} onClick={onCopy} className="w-full">
          Copy Command
        </Button>
      ) : (
        <div className="grid w-full grid-cols-1 gap-[var(--spacing-system-l)] md:grid-cols-2">
          <Button variant="outline" leftIcon={<Copy01Icon />} onClick={onCopy}>
            Copy Command
          </Button>
          {primary === 'deploy' ? (
            <Button
              variant="accent"
              onClick={onDeploy}
              disabled={!canDeployHere || deploying}
              loading={deploying}
              title={canDeployHere ? undefined : 'Pick the platform this device runs on'}
            >
              Deploy on this Device
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={onContinue}
              disabled={!continueReady || continuing}
              loading={!continueReady || continuing}
              title={continueReady ? undefined : 'Waiting for the AI assistant to come up on the device'}
            >
              Continue
            </Button>
          )}
        </div>
      )}
      <p className="text-center text-ods-text-secondary text-h6">{hint}</p>
    </div>
  );
}

/** The step while its reads are out: the platform it will open on, a bar for the command, the actions inert. */
function DeployDeviceLoading() {
  const [platform] = useState<OSPlatformId>(detectPlatform);
  const [localSupported] = useState(canInstallAgentLocally);
  return (
    <div className={BODY_CLASS}>
      <OsPlatformSelector
        value={platform}
        onValueChange={noop}
        disabledPlatforms={DISABLED_PLATFORMS}
        options={PLATFORM_OPTIONS}
      />
      <StepCommandField>
        <TextLineSkeleton type="code" className="min-w-0 flex-1" />
      </StepCommandField>
      <DeployActions
        primary={localSupported ? 'deploy' : 'none'}
        canDeployHere={false}
        deploying={false}
        continueReady={false}
        continuing={false}
        hint={HINT_USUAL}
        onCopy={noop}
        onDeploy={noop}
        onContinue={noop}
      />
    </div>
  );
}

function DeployDeviceForm({ organizationId, onContinue, persisting }: DeployDeviceStepProps) {
  const { toast } = useToast();
  const organizations = useDeviceOrganizations(100);
  const effectiveOrganizationId =
    organizationId ??
    organizations.find(organization => !organization.isDefault)?.organizationId ??
    organizations.find(organization => organization.isDefault)?.organizationId ??
    organizations[0]?.organizationId ??
    '';

  const [hostPlatform] = useState<OSPlatformId>(detectPlatform);
  const [platform, setPlatform] = useState<OSPlatformId>(hostPlatform);
  const [expanded, setExpanded] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  // The first copy only: copying again does not restart the wait.
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const local = useLocalAgentInstall();
  const { command, initialKey, installRequest } = useInstallCommand({
    organizationId: effectiveOrganizationId,
    platform,
  });
  const { copy } = useCopyToClipboard({
    successDescription: 'Installer command copied to clipboard',
    errorDescription: 'Could not copy command',
  });

  const device = useFirstDeviceEnrollment(true);
  const lines = checklistLines(handedOver, device);
  const enrolled = device?.stages.aiReady ?? false;

  // The wait for the agent to reach the platform runs from the machine's
  // registration (a server stamp, so a reload does not restart it); before the
  // machine registers, from the hand-over: the command copied, or a local
  // install that went through - a failed or declined run starts nothing.
  const installedAt = local.status === 'succeeded' ? local.settledAt : null;
  const waitingSince = device?.registeredAt ?? earliest(copiedAt, installedAt);
  const connected = device?.stages.connected ?? false;
  // The clock ticks only while a deadline is pending: nothing handed over yet,
  // or the agent already connected, is nothing to time.
  const now = useNow(DEADLINE_TICK_MS, waitingSince != null && !connected);
  const timedOut = !connected && waitingSince != null && now >= waitingSince + AGENT_CONNECT_TIMEOUT_MS;

  // A failed local run says so once, when it settles; the log keeps the detail.
  const reportedFailureRef = useRef<AgentInstallError | null>(null);
  useEffect(() => {
    if (local.status !== 'failed' || reportedFailureRef.current === local.error) return;
    reportedFailureRef.current = local.error;
    toast({ ...installFailureCopy(local.error), variant: 'destructive' });
  }, [local.status, local.error, toast]);

  /** The command is ready to hand over; says why not otherwise. */
  const commandReady = (): boolean => {
    if (!effectiveOrganizationId) {
      toast({ title: 'No customer', description: 'Add a customer before enrolling a device', variant: 'destructive' });
      return false;
    }
    if (!initialKey) {
      toast({ title: 'Secret unavailable', description: 'Registration secret not loaded yet', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleCopy = () => {
    if (!commandReady()) return;
    trackDashboardActivity(EVENT_SUBTYPE.ADD_DEVICE);
    void copy(command);
    setHandedOver(true);
    setCopiedAt(at => at ?? Date.now());
  };

  // The shell installs for the OS it is on; the selector may be
  // showing another platform's command for copying elsewhere.
  const canDeployHere = local.supported && platform === hostPlatform;
  // Locked from the click until the run says how it went: an install hands
  // over to "Continue", a failure or a declined prompt offers the run again.
  const deploying = local.status === 'running';
  const handleDeploy = () => {
    if (!canDeployHere || deploying || !commandReady()) return;
    trackDashboardActivity(EVENT_SUBTYPE.ADD_DEVICE);
    setHandedOver(true);
    void local.start(installRequest);
  };

  // An install that went through, or a device up from a copied command, is
  // nothing left to run: the way on is "Continue", live once the assistant is.
  const primary: PrimaryAction =
    local.status === 'succeeded' || enrolled ? 'continue' : local.supported ? 'deploy' : 'none';
  const handleContinue = () => {
    if (device && enrolled && !persisting) onContinue(device);
  };

  return (
    <>
      {/* The log sits under the controls at their spacing, in a column of its own:
          opened out it is wider than they are. */}
      <div className="flex w-full flex-col items-center gap-[var(--spacing-system-m)]">
        <div className={BODY_CLASS}>
          <OsPlatformSelector
            value={platform}
            onValueChange={setPlatform}
            disabledPlatforms={DISABLED_PLATFORMS}
            options={PLATFORM_OPTIONS}
          />
          <StepCommandField>
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
          </StepCommandField>
          <DeployActions
            primary={primary}
            canDeployHere={canDeployHere}
            deploying={deploying}
            continueReady={enrolled}
            continuing={persisting}
            hint={timedOut ? HINT_LONGER : HINT_USUAL}
            onCopy={handleCopy}
            onDeploy={handleDeploy}
            onContinue={handleContinue}
          />
        </div>
        {local.status !== 'idle' && <InstallLog lines={local.lines} />}
      </div>
      {lines.length > 0 && (
        <ol className="flex flex-col items-center gap-[var(--spacing-system-xxs)]" aria-label="Deployment progress">
          {/* Newest on top: the list grows upwards as the agent reports in, so the
              stage still to come shows where it will land, until the last one has. */}
          {!enrolled && (
            <li className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-primary text-h6">
              <DotsLoaderIcon aria-hidden className="size-4 text-ods-text-secondary" />
              Waiting for device to connect
            </li>
          )}
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
      {timedOut && <AgentNotConnectedNotice platform={platform} />}
    </>
  );
}
