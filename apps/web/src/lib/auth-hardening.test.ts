import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAuthHardening } from './auth-hardening';

const fixture = vi.hoisted(() => ({
  sharedAuth: true,
  tenantMode: false,
  getAuthHardening: vi.fn(),
}));

vi.mock('./app-mode', () => ({
  isSharedAuthUi: () => fixture.sharedAuth,
  isSaasTenantMode: () => fixture.tenantMode,
}));
vi.mock('./auth-api-client', () => ({ authApiClient: { getAuthHardening: fixture.getAuthHardening } }));

afterEach(() => {
  fixture.sharedAuth = true;
  fixture.tenantMode = false;
  fixture.getAuthHardening.mockReset();
});

describe('Shared Auth capability', () => {
  it.each([false, true])('uses the reported mode %s', async enabled => {
    fixture.getAuthHardening.mockResolvedValue({ ok: true, status: 200, data: { enabled } });

    await expect(readAuthHardening()).resolves.toBe(enabled);
  });

  it('keeps the original contract with a backend that predates the switch', async () => {
    fixture.getAuthHardening.mockResolvedValue({ ok: false, status: 404 });

    await expect(readAuthHardening()).resolves.toBe(false);
  });

  it.each([
    { ok: false, status: 0 },
    { ok: false, status: 503 },
    { ok: true, status: 200, data: { enabled: 'false' } },
  ])('does not select the original contract on an unavailable or invalid answer', async response => {
    fixture.getAuthHardening.mockResolvedValue(response);

    await expect(readAuthHardening()).rejects.toThrow('Could not check which sign-in options are available.');
  });

  it('does not ask self-hosted deployments for the Shared capability', async () => {
    fixture.sharedAuth = false;

    await expect(readAuthHardening()).resolves.toBe(false);
    expect(fixture.getAuthHardening).not.toHaveBeenCalled();
  });
});
