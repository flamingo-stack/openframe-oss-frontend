/**
 * Pins the client download step of the install and uninstall commands: every
 * platform variant fetches the bundle with the `x-machine-id` header, and the
 * id handed to it is a fresh v4 UUID each time.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildInstallCommand,
  buildUninstallCommand,
  MACHINE_ID_HEADER,
  newDownloadMachineId,
} from './device-command-utils';

const BASE = 'https://tenant.example.com';
const MACHINE_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const WINDOWS_DOWNLOAD =
  `Set-Location ~; Remove-Item -Path 'openframe-client.zip','openframe-client.exe' -Force -ErrorAction SilentlyContinue; ` +
  `Invoke-WebRequest -Uri '${BASE}/v0/api/assets/download?agent=client&platform=windows' -Headers @{ '${MACHINE_ID_HEADER}' = '${MACHINE_ID}' } -OutFile 'openframe-client.zip'; ` +
  `Expand-Archive -Path 'openframe-client.zip' -DestinationPath '.' -Force`;

const MAC_DOWNLOAD =
  `cd ~ && rm -f openframe-client_macos.tar.gz openframe-client 2>/dev/null; ` +
  `curl -fL -H '${MACHINE_ID_HEADER}: ${MACHINE_ID}' -o openframe-client_macos.tar.gz '${BASE}/v0/api/assets/download?agent=client&platform=macos' && ` +
  `tar -xzf openframe-client_macos.tar.gz && sudo chmod +x ./openframe-client`;

describe('newDownloadMachineId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a v4 uuid that differs on every call', () => {
    const ids = Array.from({ length: 50 }, newDownloadMachineId);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still returns a v4 uuid where crypto.randomUUID is unavailable (insecure context)', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(typeof globalThis.crypto.randomUUID).toBe('undefined');
    const ids = Array.from({ length: 50 }, newDownloadMachineId);
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildInstallCommand', () => {
  const common = {
    serverUrl: 'tenant.example.com',
    initialKey: 'secret-1',
    orgId: 'org-1',
    downloadBaseUrl: BASE,
    machineId: MACHINE_ID,
    userId: 'user-1',
  };
  const tail = 'install --serverUrl tenant.example.com --initialKey secret-1 --orgId org-1 --userId user-1';

  it('windows: downloads through Invoke-WebRequest with the machine-id header', () => {
    expect(buildInstallCommand({ ...common, platform: 'windows', additionalArgs: ['--tag "env=prod"'] })).toBe(
      `${WINDOWS_DOWNLOAD}; & '.\\openframe-client.exe' ${tail} --tag "env=prod"`,
    );
  });

  it('darwin: downloads through curl with the machine-id header', () => {
    expect(buildInstallCommand({ ...common, platform: 'darwin', additionalArgs: ["--tag 'env=prod'"] })).toBe(
      `${MAC_DOWNLOAD} && sudo ./openframe-client ${tail} --tag 'env=prod'`,
    );
  });

  it('linux: shares the macos bundle and the same header', () => {
    expect(buildInstallCommand({ ...common, platform: 'linux' })).toBe(
      `${MAC_DOWNLOAD} && sudo ./openframe-client ${tail}`,
    );
  });

  it('stamps whatever id it is given, so two commands never share one by construction', () => {
    const a = buildInstallCommand({ ...common, platform: 'darwin', machineId: newDownloadMachineId() });
    const b = buildInstallCommand({ ...common, platform: 'darwin', machineId: newDownloadMachineId() });
    expect(a).not.toBe(b);
    expect(a).toMatch(new RegExp(`-H '${MACHINE_ID_HEADER}: [0-9a-f-]{36}'`));
  });
});

describe('buildUninstallCommand', () => {
  it('sends the header on both platform variants', () => {
    expect(buildUninstallCommand({ platform: 'windows', downloadBaseUrl: BASE, machineId: MACHINE_ID })).toBe(
      `${WINDOWS_DOWNLOAD}; Start-Process -FilePath '.\\openframe-client.exe' -ArgumentList 'uninstall' -Verb RunAs -Wait`,
    );
    expect(buildUninstallCommand({ platform: 'darwin', downloadBaseUrl: BASE, machineId: MACHINE_ID })).toBe(
      `${MAC_DOWNLOAD} && sudo ./openframe-client uninstall`,
    );
  });
});
