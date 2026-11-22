/**
 * `recaptchaHeaders`: the token header the edge firewall reads on password signup and reset. Pins
 * that a token goes out per call, and that no key, a shell, or a script that never answers sends the
 * request without one instead of failing it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ key: 'site-key' as string | undefined, shell: false }));
vi.mock('./platform', () => ({ isAppShell: () => env.shell }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { recaptchaSiteKey: () => env.key } }));

type Execute = (key: string, options: { action: string }) => Promise<string>;

async function load(execute?: Execute) {
  vi.resetModules();
  const appended: HTMLScriptElement[] = [];
  vi.spyOn(document.head, 'appendChild').mockImplementation(node => {
    const script = node as HTMLScriptElement;
    appended.push(script);
    if (execute) {
      (window as unknown as { grecaptcha: unknown }).grecaptcha = {
        enterprise: { ready: (callback: () => void) => callback(), execute },
      };
      queueMicrotask(() => script.onload?.(new Event('load')));
    }
    return node;
  });
  const recaptcha = await import('./recaptcha');
  return { ...recaptcha, appended };
}

beforeEach(() => {
  env.key = 'site-key';
  env.shell = false;
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete (window as unknown as { grecaptcha?: unknown }).grecaptcha;
});

describe('recaptchaHeaders', () => {
  it('sends a fresh token for the action, loading the script once', async () => {
    const execute = vi.fn<Execute>().mockResolvedValueOnce('t1').mockResolvedValueOnce('t2');
    const { recaptchaHeaders, appended } = await load(execute);

    expect(await recaptchaHeaders('signup')).toEqual({ 'X-Recaptcha-Token': 't1' });
    expect(await recaptchaHeaders('password_reset')).toEqual({ 'X-Recaptcha-Token': 't2' });
    expect(execute).toHaveBeenNthCalledWith(1, 'site-key', { action: 'signup' });
    expect(execute).toHaveBeenNthCalledWith(2, 'site-key', { action: 'password_reset' });
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe('https://www.google.com/recaptcha/enterprise.js?render=site-key');
  });

  it('sends nothing without a site key', async () => {
    env.key = undefined;
    const { recaptchaHeaders, appended } = await load(vi.fn<Execute>());

    expect(await recaptchaHeaders('signup')).toEqual({});
    expect(appended).toHaveLength(0);
  });

  it('sends nothing in a shell, whose CSP and origin the key cannot serve', async () => {
    env.shell = true;
    const { recaptchaHeaders, appended } = await load(vi.fn<Execute>());

    expect(await recaptchaHeaders('signup')).toEqual({});
    expect(appended).toHaveLength(0);
  });

  it('gives up on a script that never answers, and retries the load on the next call', async () => {
    vi.useFakeTimers();
    const { recaptchaHeaders, appended } = await load();

    const first = recaptchaHeaders('signup');
    appended[0].onerror?.(new Event('error'));
    expect(await first).toEqual({});

    const second = recaptchaHeaders('signup');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await second).toEqual({});
    expect(appended).toHaveLength(2);
  });
});
