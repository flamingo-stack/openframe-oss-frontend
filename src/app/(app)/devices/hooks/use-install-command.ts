import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { useMemo, useSyncExternalStore } from 'react';
import type { TagEntry } from '@/app/components/shared/tags';
import { isAppShell } from '@/lib/platform';
import { runtimeEnv } from '@/lib/runtime-config';
import { selectUser, useAuthStore } from '@/stores';
import { assetsDownloadBase, buildInstallCommand, buildRegisterCommand } from '../utils/device-command-utils';
import { useRegistrationSecret } from './use-registration-secret';

interface UseInstallCommandOptions {
  organizationId: string;
  platform: OSPlatformId;
  tags?: TagEntry[];
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

export function useInstallCommand({ organizationId, platform, tags = [] }: UseInstallCommandOptions) {
  const { initialKey } = useRegistrationSecret();
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

  const command = useMemo(
    () =>
      buildInstallCommand({
        platform,
        serverUrl,
        initialKey,
        orgId: organizationId,
        downloadBaseUrl,
        userId,
        additionalArgs: buildTagArgs(tags, platform),
      }),
    [initialKey, tags, platform, organizationId, serverUrl, downloadBaseUrl, userId],
  );

  // Step 2 of the package-manager install flow (step 1 installs the binary, so
  // no download URL here — the agent is already on the machine).
  const registerCommand = useMemo(
    () =>
      buildRegisterCommand({
        platform,
        serverUrl,
        initialKey,
        orgId: organizationId,
        userId,
        additionalArgs: buildTagArgs(tags, platform),
      }),
    [initialKey, tags, platform, organizationId, serverUrl, userId],
  );

  return { command, registerCommand, initialKey };
}
