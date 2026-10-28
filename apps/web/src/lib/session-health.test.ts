import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokens = vi.hoisted(() => ({
  epoch: 1,
  stored: true,
  bearer: true,
  listeners: new Set<() => void>(),
}));

vi.mock('./token-store', () => ({
  getTokenEpoch: () => tokens.epoch,
  hasTokensSync: () => tokens.stored,
  isBearerAuthMode: () => tokens.bearer,
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
  tokens.stored = true;
  tokens.bearer = true;
});

describe('session health', () => {
  it('starts healthy', async () => {
    const health = await load();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a transient pause resumes on a 2xx from the gateway', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    expect(health.getSessionHealth()).toBe('paused');
    expect(health.noteGatewayResponse(res(401))).toBe(false);
    expect(health.getSessionHealth()).toBe('paused');
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a rejected pause is not cleared by a 2xx from an unrelated request', async () => {
    const health = await load();
    health.markSessionPaused('rejected');
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.noteGatewayResponse(res(200))).toBe(false);
    expect(health.getSessionHealth()).toBe('paused');
    health.markSessionHealthy();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a rejected pause outlives a token rotation: the next 401 rotates, and would end its own pause', async () => {
    const health = await load();
    health.markSessionPaused('rejected');
    tokens.epoch = 2;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('a bearer sign-out leaves gone in place: the store is cleared while the app still looks signed in', async () => {
    const health = await load();
    health.noteGatewayResponse(res(410));
    tokens.stored = false;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('gone');
  });

  it('the next bearer sign-in ends whatever was known about the last session, a pause or gone', async () => {
    const health = await load();
    health.markSessionPaused('rejected');
    tokens.stored = false;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
    tokens.stored = true;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');

    health.noteGatewayResponse(res(410));
    tokens.stored = false;
    emitTokenChange();
    tokens.stored = true;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a cookie-mode token change is read as neither a sign-out nor a sign-in', async () => {
    const health = await load();
    tokens.bearer = false;
    tokens.stored = false;
    health.markSessionPaused('rejected');
    emitTokenChange();
    tokens.stored = true;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('a rejection upgrades a transient pause, and a transient mark never downgrades a rejected one', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    health.markSessionPaused('rejected');
    health.noteGatewayResponse(res(200));
    expect(health.getSessionHealth()).toBe('paused');
    health.markSessionHealthy();
    health.markSessionPaused('rejected');
    health.markSessionPaused('transient');
    health.noteGatewayResponse(res(200));
    expect(health.getSessionHealth()).toBe('paused');
  });

  it('clears a pause on a token rotation, but not on a change at the same epoch', async () => {
    const health = await load();
    health.markSessionPaused('transient');
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('paused');
    tokens.epoch = 2;
    emitTokenChange();
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('clearPauseIfTokenRotated covers a cookie-mode rotation that emits nothing', async () => {
    const health = await load();
    health.markSessionPaused('transient');
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
    health.markSessionPaused('transient');
    expect(health.getSessionHealth()).toBe('gone');
  });

  it("treats a JSON 410 as the caller's own answer, not a deleted tenant", async () => {
    const health = await load();
    expect(health.noteGatewayResponse(res(410, 'application/json'))).toBe(false);
    expect(health.getSessionHealth()).toBe('healthy');
  });

  it('a pause can turn into gone', async () => {
    const health = await load();
    health.markSessionPaused('transient');
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
