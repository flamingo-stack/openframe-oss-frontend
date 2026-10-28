import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { markSessionPaused, noteGatewayResponse, resetSessionHealth } from '@/lib/session-health';
import { decideReconnect } from './nats-app-config';

const { me, refreshTokens, forceLogout } = vi.hoisted(() => ({
  me: vi.fn(),
  refreshTokens: vi.fn(),
  forceLogout: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiClient: { me: () => me() } }));
vi.mock('@/lib/token-refresh-manager', () => ({ refreshTokens: () => refreshTokens() }));
vi.mock('@/lib/force-logout', () => ({ forceLogout: () => forceLogout() }));
vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({ useAuthStore: vi.fn() }));

const decide = (consecutiveFailures: number) => decideReconnect({ consecutiveFailures });

describe('decideReconnect', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    // Module state (the refresh cooldown) outlives a test: start each one past it.
    vi.setSystemTime(Date.now() + 60 * 60_000);
    me.mockReset();
    refreshTokens.mockReset();
    forceLogout.mockReset();
    resetSessionHealth();
  });

  it('is terminal when /api/me finds the tenant deleted', async () => {
    // What apiClient does with the gateway's deleted-tenant page before returning it.
    me.mockImplementation(() => {
      noteGatewayResponse(new Response('', { status: 410, headers: { 'Content-Type': 'text/html' } }));
      return Promise.resolve({ ok: false, status: 410 });
    });
    expect(await decide(0)).toBe('terminal');
  });

  it("continues on a service's own JSON 410, which is not a deleted tenant", async () => {
    me.mockResolvedValue({ ok: false, status: 410 });
    expect(await decide(0)).toBe('continue');
  });

  it('pauses on a 401 that survived the refresh-and-retry', async () => {
    me.mockResolvedValue({ ok: false, status: 401 });
    expect(await decide(0)).toBe('pause');
  });

  it('keeps dialling without asking /api/me while the session is paused as rejected', async () => {
    markSessionPaused('rejected');
    // Even at the threshold: the connection's own auto-pause bounds the dials,
    // and a forced refresh here would spend a rotation the refusal ignores.
    expect(await decide(5)).toBe('continue');
    expect(me).not.toHaveBeenCalled();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('still asks /api/me during a transient pause', async () => {
    markSessionPaused('transient');
    me.mockResolvedValue({ ok: true, status: 200 });
    expect(await decide(1)).toBe('continue');
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('continues on a network failure or a transient status', async () => {
    me.mockResolvedValueOnce({ ok: false, status: 0 });
    me.mockResolvedValueOnce({ ok: false, status: 503 });
    me.mockRejectedValueOnce(new Error('boom'));
    expect(await decide(2)).toBe('continue');
    expect(await decide(2)).toBe('continue');
    expect(await decide(2)).toBe('continue');
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('continues while the session is fine and failures are few', async () => {
    me.mockResolvedValue({ ok: true, status: 200 });
    expect(await decide(4)).toBe('continue');
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it('forces one token refresh, then pauses, once an alive session keeps failing the dial', async () => {
    me.mockResolvedValue({ ok: true, status: 200 });
    refreshTokens.mockResolvedValue('refreshed');
    expect(await decide(5)).toBe('pause');
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(forceLogout).not.toHaveBeenCalled();
  });

  it('signs out when the forced refresh is rejected, as apiClient does', async () => {
    me.mockResolvedValue({ ok: true, status: 200 });
    refreshTokens.mockResolvedValue('terminal');
    expect(await decide(5)).toBe('pause');
    expect(forceLogout).toHaveBeenCalledTimes(1);
  });

  it('does not rotate again inside the cooldown, even after the new token spawns a fresh connection', async () => {
    me.mockResolvedValue({ ok: true, status: 200 });
    refreshTokens.mockResolvedValue('refreshed');
    expect(await decide(5)).toBe('pause'); // rotation -> new URL -> new connection ...
    vi.setSystemTime(Date.now() + 10_000);
    expect(await decide(5)).toBe('pause'); // ... which reaches the threshold again
    expect(refreshTokens).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 31 * 60_000);
    expect(await decide(5)).toBe('pause');
    expect(refreshTokens).toHaveBeenCalledTimes(2);
  });
});
