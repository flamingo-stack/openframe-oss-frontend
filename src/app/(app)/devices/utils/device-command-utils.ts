/**
 * Device Command Utilities
 * Unified logic for building device installation and uninstallation commands
 */

import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { runtimeEnv } from '@/lib/runtime-config';

const ASSETS_DOWNLOAD_PATH = '/v0/api/assets/download';

/**
 * Sent with every client download so each one is identifiable on the
 * gateway side. The value is a fresh UUID per handed-out command, never a
 * constant: see `newDownloadMachineId` and `useInstallCommand`.
 */
export const MACHINE_ID_HEADER = 'x-machine-id';

/**
 * Fresh, random id for one download command. A v4 UUID - the same shape the
 * agent uses for its own machine id - and only hex plus dashes, so it is safe
 * inside the single-quoted header value on both shells.
 *
 * `crypto.randomUUID` is only defined in secure contexts; the manual v4 path
 * covers an origin that is not one (a plain-http self-hosted console).
 */
export function newDownloadMachineId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Origin the assets endpoint lives on: the tenant gateway this bundle talks
 * to (`NEXT_PUBLIC_TENANT_HOST_URL`, backed by the host a native shell
 * learned at login). When unset the browser origin fronts the same gateway.
 * '' during prerender — the hydrated client corrects it, which is why
 * `use-install-command` reads this through its store.
 */
export function assetsDownloadBase(): string {
  const tenantHost = runtimeEnv.tenantHostUrl();
  if (tenantHost) return tenantHost.replace(/\/+$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * The endpoint publishes exactly two bundles, so every non-Windows platform
 * (darwin and linux alike) downloads the macos one. No version in the URL —
 * the endpoint always redirects to the latest release.
 */
export function buildAssetsDownloadUrl(baseUrl: string, platform: OSPlatformId): string {
  const assetPlatform = platform === 'windows' ? 'windows' : 'macos';
  return `${baseUrl}${ASSETS_DOWNLOAD_PATH}?agent=client&platform=${assetPlatform}`;
}

/**
 * The download-and-unpack step shared by the install and uninstall commands:
 * fetch the bundle for `platform` from `downloadBaseUrl` with the machine-id
 * header, and leave an executable `openframe-client` in the home directory.
 * The command-specific tail (`install …` / `uninstall`) is appended by the
 * caller.
 */
function buildDownloadStep(platform: OSPlatformId, downloadBaseUrl: string, machineId: string): string {
  const url = buildAssetsDownloadUrl(downloadBaseUrl, platform);

  if (platform === 'windows') {
    return `Set-Location ~; Remove-Item -Path 'openframe-client.zip','openframe-client.exe' -Force -ErrorAction SilentlyContinue; Invoke-WebRequest -Uri '${url}' -Headers @{ '${MACHINE_ID_HEADER}' = '${machineId}' } -OutFile 'openframe-client.zip'; Expand-Archive -Path 'openframe-client.zip' -DestinationPath '.' -Force`;
  }

  // macOS / darwin (and linux - same bundle, see buildAssetsDownloadUrl)
  return `cd ~ && rm -f openframe-client_macos.tar.gz openframe-client 2>/dev/null; curl -fL -H '${MACHINE_ID_HEADER}: ${machineId}' -o openframe-client_macos.tar.gz '${url}' && tar -xzf openframe-client_macos.tar.gz && sudo chmod +x ./openframe-client`;
}

export interface InstallCommandOptions {
  platform: OSPlatformId;
  serverUrl: string;
  initialKey: string;
  orgId: string;
  downloadBaseUrl: string;
  /** Value of the download's machine-id header; see `newDownloadMachineId`. */
  machineId: string;
  userId?: string;
  additionalArgs?: string[];
}

/**
 * Build the device installation command
 */
export function buildInstallCommand(options: InstallCommandOptions): string {
  const { platform, serverUrl, initialKey, orgId, downloadBaseUrl, machineId, userId, additionalArgs = [] } = options;

  const userArg = userId ? ` --userId ${userId}` : '';
  const baseArgs = `install --serverUrl ${serverUrl} --initialKey ${initialKey} --orgId ${orgId}${userArg}`;
  const extras = additionalArgs.length ? ' ' + additionalArgs.join(' ') : '';
  const download = buildDownloadStep(platform, downloadBaseUrl, machineId);

  if (platform === 'windows') {
    return `${download}; & '.\\openframe-client.exe' ${baseArgs}${extras}`;
  }

  // macOS / darwin
  return `${download} && sudo ./openframe-client ${baseArgs}${extras}`;
}

export type InstallMethod = 'script' | 'winget' | 'chocolatey' | 'brew';

interface PackageManagerMethod {
  /** Option label in the Install Method dropdown */
  label: string;
  /** Title above the step-1 command block */
  commandTitle: string;
  /** Step 1: install the agent through the package manager */
  installCommand: string;
}

/** Package names/commands come from DevOps packaging and may change before release. */
export const PACKAGE_MANAGER_METHODS: Record<Exclude<InstallMethod, 'script'>, PackageManagerMethod> = {
  winget: {
    label: 'Winget',
    commandTitle: 'Winget Install Command',
    installCommand: 'winget install openframe',
  },
  chocolatey: {
    label: 'Chocolatey',
    commandTitle: 'Chocolatey Install Command',
    installCommand: 'choco install openframe -y',
  },
  brew: {
    label: 'Brew',
    commandTitle: 'Brew Install Command',
    installCommand: 'brew install --cask openframe',
  },
};

export function installMethodLabel(method: InstallMethod): string {
  return method === 'script' ? 'Script' : PACKAGE_MANAGER_METHODS[method].label;
}

/**
 * Package-manager installs are not live yet (packages pending DevOps
 * publishing), so every method except the install script is shown disabled in
 * the Install Method dropdown until they ship.
 */
export function isInstallMethodEnabled(method: InstallMethod): boolean {
  return method === 'script';
}

export function installMethodsForPlatform(platform: OSPlatformId): InstallMethod[] {
  if (platform === 'windows') return ['script', 'winget', 'chocolatey'];
  if (platform === 'darwin') return ['script', 'brew'];
  return ['script'];
}

export interface RegisterCommandOptions {
  platform: OSPlatformId;
  serverUrl: string;
  initialKey: string;
  orgId: string;
  userId?: string;
  additionalArgs?: string[];
}

/** Step 2 after a package-manager install: enroll the already-installed agent. */
export function buildRegisterCommand(options: RegisterCommandOptions): string {
  const { platform, serverUrl, initialKey, orgId, userId, additionalArgs = [] } = options;

  const userArg = userId ? ` --userId ${userId}` : '';
  const extras = additionalArgs.length ? ' ' + additionalArgs.join(' ') : '';
  const command = `openframe auth --serverUrl ${serverUrl} --initialKey ${initialKey} --orgId ${orgId}${userArg}${extras}`;
  return platform === 'windows' ? command : `sudo ${command}`;
}

export interface UninstallCommandOptions {
  platform: OSPlatformId;
  downloadBaseUrl: string;
  /** Value of the download's machine-id header; see `newDownloadMachineId`. */
  machineId: string;
}

/**
 * Build the device uninstallation command
 */
export function buildUninstallCommand(options: UninstallCommandOptions): string {
  const { platform, downloadBaseUrl, machineId } = options;
  const download = buildDownloadStep(platform, downloadBaseUrl, machineId);

  if (platform === 'windows') {
    return `${download}; Start-Process -FilePath '.\\openframe-client.exe' -ArgumentList 'uninstall' -Verb RunAs -Wait`;
  }

  // macOS / darwin
  return `${download} && sudo ./openframe-client uninstall`;
}

/**
 * Normalize OS type from various device fields to OSPlatformId
 */
export function normalizeDevicePlatform(platform?: string, osType?: string, operatingSystem?: string): OSPlatformId {
  const osValue = (platform || osType || operatingSystem || '').toLowerCase();

  if (osValue.includes('windows') || osValue === 'win' || osValue === 'win32' || osValue === 'win64') {
    return 'windows';
  }

  if (osValue.includes('darwin') || osValue.includes('mac') || osValue.includes('osx')) {
    return 'darwin';
  }

  if (
    osValue.includes('linux') ||
    osValue.includes('ubuntu') ||
    osValue.includes('debian') ||
    osValue.includes('centos') ||
    osValue.includes('redhat') ||
    osValue.includes('fedora')
  ) {
    return 'linux';
  }

  // Default to darwin if unknown
  return 'darwin';
}
