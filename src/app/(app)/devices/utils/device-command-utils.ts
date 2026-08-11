/**
 * Device Command Utilities
 * Unified logic for building device installation and uninstallation commands
 */

import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { runtimeEnv } from '@/lib/runtime-config';

const ASSETS_DOWNLOAD_PATH = '/v0/api/assets/download';

/**
 * Origin the assets endpoint lives on. The binaries are served by the shared
 * host (same source as `auth-api-client`), not the tenant subdomain the
 * browser is on; local dev has no shared host, and there the browser origin
 * fronts the same gateway. '' during prerender — the hydrated client corrects
 * it, which is why `use-install-command` reads this through its store.
 */
export function assetsDownloadBase(): string {
  const shared = runtimeEnv.sharedHostUrl();
  if (shared) return shared.replace(/\/+$/, '');
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

export interface InstallCommandOptions {
  platform: OSPlatformId;
  serverUrl: string;
  initialKey: string;
  orgId: string;
  downloadBaseUrl: string;
  additionalArgs?: string[];
}

/**
 * Build the device installation command
 */
export function buildInstallCommand(options: InstallCommandOptions): string {
  const { platform, serverUrl, initialKey, orgId, downloadBaseUrl, additionalArgs = [] } = options;

  const baseArgs = `install --serverUrl ${serverUrl} --initialKey ${initialKey} --orgId ${orgId}`;
  const extras = additionalArgs.length ? ' ' + additionalArgs.join(' ') : '';

  if (platform === 'windows') {
    const windowsBinaryUrl = buildAssetsDownloadUrl(downloadBaseUrl, platform);
    const argString = `${baseArgs}${extras}`;
    return `Set-Location ~; Remove-Item -Path 'openframe-client.zip','openframe-client.exe' -Force -ErrorAction SilentlyContinue; Invoke-WebRequest -Uri '${windowsBinaryUrl}' -OutFile 'openframe-client.zip'; Expand-Archive -Path 'openframe-client.zip' -DestinationPath '.' -Force; & '.\\openframe-client.exe' ${argString}`;
  }

  // macOS / darwin
  const macBinaryUrl = buildAssetsDownloadUrl(downloadBaseUrl, platform);
  return `cd ~ && rm -f openframe-client_macos.tar.gz openframe-client 2>/dev/null; curl -fL -o openframe-client_macos.tar.gz '${macBinaryUrl}' && tar -xzf openframe-client_macos.tar.gz && sudo chmod +x ./openframe-client && sudo ./openframe-client ${baseArgs}${extras}`;
}

export interface UninstallCommandOptions {
  platform: OSPlatformId;
  downloadBaseUrl: string;
}

/**
 * Build the device uninstallation command
 */
export function buildUninstallCommand(options: UninstallCommandOptions): string {
  const { platform, downloadBaseUrl } = options;

  if (platform === 'windows') {
    const windowsBinaryUrl = buildAssetsDownloadUrl(downloadBaseUrl, platform);
    return `Set-Location ~; Remove-Item -Path 'openframe-client.zip','openframe-client.exe' -Force -ErrorAction SilentlyContinue; Invoke-WebRequest -Uri '${windowsBinaryUrl}' -OutFile 'openframe-client.zip'; Expand-Archive -Path 'openframe-client.zip' -DestinationPath '.' -Force; Start-Process -FilePath '.\\openframe-client.exe' -ArgumentList 'uninstall' -Verb RunAs -Wait`;
  }

  // macOS / darwin
  const macBinaryUrl = buildAssetsDownloadUrl(downloadBaseUrl, platform);
  return `cd ~ && rm -f openframe-client_macos.tar.gz openframe-client 2>/dev/null; curl -fL -o openframe-client_macos.tar.gz '${macBinaryUrl}' && tar -xzf openframe-client_macos.tar.gz && sudo chmod +x ./openframe-client && sudo ./openframe-client uninstall`;
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
