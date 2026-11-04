import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { TagEntry } from '@/app/components/shared/tags';
import type { AgentInstallRequest } from '@/lib/native-shell';
import { isAppShell } from '@/lib/platform';
import { runtimeEnv } from '@/lib/runtime-config';
import { selectUser, useAuthStore } from '@/stores';
import type { RemoteAccessMode } from '../types/remote-access';
import {
  assetsDownloadBase,
  buildInstallCommand,
  buildRegisterCommand,
  buildRemoteAccessModeArgs,
  newDownloadMachineId,
} from '../utils/device-command-utils';
import { useAgentLogKey } from './use-agent-log-key';
import { useRegistrationSecret } from './use-registration-secret';

interface UseInstallCommandOptions {
  organizationId: string;
  platform: OSPlatformId;
  tags?: TagEntry[];
  /** The device's own remote access mode; null/absent = follows its customer (no flag). */
  remoteAccessMode?: RemoteAccessMode | null;
}

function buildTagArgs(tags: TagEntry[], platform: OSPlatformId): string[] {
  const quote = platform === 'windows' ? '"' : "'";
  return tags.flatMap(tag => tag.values.map(value => `--tag ${quote}${tag.key}=${value}${quote}`));
}

/**
 * An agent pointed at the developer's own box needs to be told so. Takes a
 * `host`, so the local test has to look past a port — `localhost:8443` is still
 * the developer's own box.
 */
function withLocalMode(host: string): string {
  const hostname = host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost --localMode' : host;
}

/**
 * Host of the tenant gateway this bundle talks to; '' when unresolvable.
 * `host`, not `hostname`: a self-hosted gateway on a non-default port has to
 * keep it or the agent calls the wrong endpoint.
 */
function tenantGatewayHost(): string {
  const url = runtimeEnv.tenantHostUrl();
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * The host the enrolling agent must call home to.
 *
 * `window.location` answers that on the web only. Both native shells serve the
 * bundle from their own origin — `capacitor://localhost` on the phone,
 * `tauri://localhost` on the desktop — so reading it there produced
 * `localhost --localMode`, an install command that points the agent at the
 * device the console is running on and puts it in local mode. In a shell the
 * tenant host is the one the app is already making every API call against:
 * build-time `NEXT_PUBLIC_TENANT_HOST_URL`, else the host learned at login.
 *
 * Reads `window` unguarded: this is `useSyncExternalStore`'s `getSnapshot`, and
 * React only calls it in the browser — `getServerSnapshot` owns the prerender.
 */
function currentServerUrl(): string {
  if (isAppShell()) {
    const host = tenantGatewayHost();
    if (host) return withLocalMode(host);
  }
  return withLocalMode(window.location.host);
}

/** Nothing here changes mid-session — origin and tenant host are both fixed. */
function subscribe(): () => void {
  return () => {};
}

/** Server snapshot: the prerender has no `window`, then hydration corrects it. */
function getServerSnapshot(): string {
  return 'localhost';
}

/** Same deal for the download base — its local-dev fallback reads `window`. */
function getServerDownloadBaseSnapshot(): string {
  return '';
}

/**
 * Whether this render is on the hydrated client. The machine id below is
 * random, so the prerender and the client cannot agree on it; the header
 * value is held back until hydration the same way the two snapshots above
 * hold back their `window`-dependent answers.
 */
function getClientHydratedSnapshot(): boolean {
  return true;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

export function useInstallCommand({
  organizationId,
  platform,
  tags = [],
  remoteAccessMode = null,
}: UseInstallCommandOptions) {
  const { initialKey } = useRegistrationSecret();
  // Unlike the install key, nothing waits for it: a command copied before it
  // arrives still enrolls the device (see useAgentLogKey).
  const logKey = useAgentLogKey();
  // Installing user, so registration can associate the device with whoever ran
  // the command. Populated from /api/me by useAuthSession; optional in the
  // command because the store hydrates a beat after mount.
  const userId = useAuthStore(selectUser)?.id;

  // Read through the store rather than a `useMemo`: the prerender has no
  // `window` and answers 'localhost', so computing this during the first client
  // render put a different command in the HTML than the one React hydrated
  // with. The server's answer carries through hydration and is corrected right
  // after, which is also what makes the shell branch above safe to take.
  const serverUrl = useSyncExternalStore(subscribe, currentServerUrl, getServerSnapshot);
  const downloadBaseUrl = useSyncExternalStore(subscribe, assetsDownloadBase, getServerDownloadBaseSnapshot);
  const hydrated = useSyncExternalStore(subscribe, getClientHydratedSnapshot, getServerHydratedSnapshot);

  // Value of the download's `x-machine-id` header: random,
  // fresh per visit, and rotated by the page after every copy so two devices
  // enrolled from one open tab do not download under the same id. State
  // rather than a value computed in render: a random id must survive
  // re-renders unchanged until the page asks for a new one.
  const [machineId, setMachineId] = useState(newDownloadMachineId);
  const rotateMachineId = useCallback(() => setMachineId(newDownloadMachineId()), []);

  const additionalArgs = useMemo(
    () => [...buildTagArgs(tags, platform), ...buildRemoteAccessModeArgs(remoteAccessMode)],
    [tags, platform, remoteAccessMode],
  );

  const command = useMemo(
    () =>
      buildInstallCommand({
        platform,
        serverUrl,
        initialKey,
        logKey,
        orgId: organizationId,
        downloadBaseUrl,
        machineId: hydrated ? machineId : '',
        userId,
        additionalArgs,
      }),
    [
      initialKey,
      logKey,
      additionalArgs,
      platform,
      organizationId,
      serverUrl,
      downloadBaseUrl,
      hydrated,
      machineId,
      userId,
    ],
  );

  // Step 2 of the package-manager install flow (step 1 installs the binary, so
  // no download URL here — the agent is already on the machine).
  const registerCommand = useMemo(
    () =>
      buildRegisterCommand({
        platform,
        serverUrl,
        initialKey,
        logKey,
        orgId: organizationId,
        userId,
        additionalArgs,
      }),
    [initialKey, logKey, additionalArgs, platform, organizationId, serverUrl, userId],
  );

  // What a local install needs of the same values: the desktop shell writes the
  // command itself rather than running one from the page (see AgentInstallRequest).
  // Empty stays absent: the copied command leaves the flag out, and the shell refuses it.
  const installRequest: AgentInstallRequest = {
    orgId: organizationId,
    initialKey,
    logKey: logKey || undefined,
    userId: userId || undefined,
  };

  return { command, registerCommand, initialKey, installRequest, rotateMachineId };
}
