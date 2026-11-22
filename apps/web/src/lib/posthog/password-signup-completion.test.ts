// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({
  isSaasTenant: true,
  gtmContainerId: 'GTM-TEST' as string | undefined,
  bearer: null as string | null,
}));

vi.mock('@/lib/app-mode', () => ({ isSaasTenantMode: () => settings.isSaasTenant }));
vi.mock('@/lib/runtime-config', () => ({
  runtimeEnv: {
    sharedHostUrl: () => 'https://auth.example.test',
    gtmContainerId: () => settings.gtmContainerId,
  },
}));
vi.mock('@/lib/token-store', () => ({ getBearerTokenSync: () => settings.bearer }));

const user = { id: 'owner-1', tenantId: 'workspace-1', email: 'owner@example.test', roles: ['OWNER'] };
const dataLayer = window as Window & { dataLayer?: unknown[] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  settings.isSaasTenant = true;
  settings.gtmContainerId = 'GTM-TEST';
  settings.bearer = null;
  delete dataLayer.dataLayer;
});

describe('password signup conversion', () => {
  it('pushes the existing GTM event once after the server grants the claim', async () => {
    const fetchClaim = vi.fn().mockResolvedValue(Response.json({ claimed: true }));
    vi.stubGlobal('fetch', fetchClaim);
    const { completePasswordSignup } = await import('./password-signup-completion');

    await Promise.all([completePasswordSignup(user), completePasswordSignup(user)]);
    await completePasswordSignup(user);

    expect(fetchClaim).toHaveBeenCalledTimes(1);
    expect(fetchClaim).toHaveBeenCalledWith(
      new URL('/sas/oauth/signup-completion', 'https://auth.example.test'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ userId: user.id, tenantId: user.tenantId }),
      }),
    );
    expect(dataLayer.dataLayer).toEqual([{ event: 'signup_completed', user_id: user.id, email: user.email }]);
  });

  it('never treats an old frontend fallback or an already completed signup as a claim', async () => {
    const fetchClaim = vi
      .fn()
      .mockResolvedValueOnce(new Response('<html></html>'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchClaim);
    const { completePasswordSignup } = await import('./password-signup-completion');

    await completePasswordSignup(user);
    await completePasswordSignup(user);
    await completePasswordSignup(user);

    expect(fetchClaim).toHaveBeenCalledTimes(2);
    expect(dataLayer.dataLayer).toBeUndefined();
  });

  it('does not consume a pending claim for an invited admin, OSS or a client without GTM', async () => {
    const fetchClaim = vi.fn();
    vi.stubGlobal('fetch', fetchClaim);
    const { completePasswordSignup } = await import('./password-signup-completion');

    await completePasswordSignup({ ...user, roles: ['ADMIN'] });
    settings.isSaasTenant = false;
    await completePasswordSignup(user);
    settings.isSaasTenant = true;
    settings.gtmContainerId = undefined;
    await completePasswordSignup(user);

    expect(fetchClaim).not.toHaveBeenCalled();
    expect(dataLayer.dataLayer).toBeUndefined();
  });
});
