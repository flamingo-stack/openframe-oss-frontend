import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokens = vi.hoisted(() => ({ epoch: 1, listeners: new Set<() => void>() }));

vi.mock('./token-store', () => ({
  getTokenEpoch: () => tokens.epoch,
  subscribeToTokenChange: (listener: () => void) => {
    tokens.listeners.add(listener);
    return () => tokens.listeners.delete(listener);
  },
}));

const res = (status: number, type = 'text/html') => new Response('', { status, headers: { 'Content-Type': type } });

async function load() {
  vi.resetModules();
  tokens.listeners.clear();
  return import('./session-health');
}

const emitTokenChange = () => {
  for (const listener of tokens.listeners) listener();
};

beforeEach(() => {
  tokens.epoch = 1;
});

describe('session health', () => {
  it('starts healthy', async () => {
    const health = await load();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('pauses, and a 2xx from the gateway resumes', async () => {
    const health = await load();
    health.markSessionPaused();
    expect(health.getSessionHealth()).toBe('paused');
    expect(health.noteGatewayResponse(res(401))).toBe(false);
    expect(health.getSessionHealth()).toBe('paused');
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('clears a pause on a token rotation, but not on a change at the same epoch', async () => {
    const health = await load();
    health.markSessionPaused();
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
    tokens.epoch = 2;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('clearPauseIfTokenRotated covers a cookie-mode rotation that emits nothing', async () => {
    const health = await load();
    health.markSessionPaused();
    tokens.epoch = 2;
    health.clearPauseIfTokenRotated();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('goes gone on a 410 and a 2xx or a rotation does not bring it back', async () => {
    const health = await load();
    expect(health.noteGatewayResponse(res(410))).toBe(true);
    expect(health.isSessionGone()).toBe(true);
    health.noteGatewayResponse(res(200));
    tokens.epoch = 2;
    emitTokenChange();
    health.markSessionPaused();
    expect(health.getSessionHealth()).toBe('gone');
  });

  it("treats a JSON 410 as the caller's own answer, not a deleted tenant", async () => {
    const health = await load();
    expect(health.noteGatewayResponse(res(410, 'application/json'))).toBe(false);
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a pause can turn into gone', async () => {
    const health = await load();
    health.markSessionPaused();
    health.noteGatewayResponse(res(410));
    expect(health.getSessionHealth()).toBe('gone');
  });

  it('resetSessionHealth is the way out of gone', async () => {
    const health = await load();
    health.noteGatewayResponse(res(410));
    health.resetSessionHealth();
    expect(health.getSessionHealth()).toBe('healthy');
  });
});
