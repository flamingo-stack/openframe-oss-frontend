import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_APP_SCHEME,
  desktopAuthReturnTarget,
  landingLocation,
  readDesktopAuthReturn,
} from './desktop-auth-return';

const SHARED_HOST = 'https://auth.openframe.example';

/** The gateway's append (`computeTargetWithOptionalDevTicketReactive`, `signupContinue`, `joinReturn`). */
function gatewayLanding(target: string, param: string): URL {
  return new URL(`${target}${target.includes('?') ? '&' : '?'}${param}`);
}

describe('desktopAuthReturnTarget', () => {
  it('names the page with a trailing slash and an empty fragment, whatever the configured host ends in', () => {
    expect(desktopAuthReturnTarget(SHARED_HOST)).toBe(`${SHARED_HOST}/auth/desktop-return/#`);
    expect(desktopAuthReturnTarget(`${SHARED_HOST}//`)).toBe(`${SHARED_HOST}/auth/desktop-return/#`);
  });

  it('puts what the gateway appends in the fragment, which never reaches a server', () => {
    const landing = gatewayLanding(desktopAuthReturnTarget(SHARED_HOST), 'devTicket=T-1');

    expect(landing.search).toBe('');
    expect(landing.hash).toBe('#?devTicket=T-1');
  });
});

describe('readDesktopAuthReturn', () => {
  const target = desktopAuthReturnTarget(SHARED_HOST);

  it('hands a sign-in on to the desktop scheme', () => {
    expect(readDesktopAuthReturn(gatewayLanding(target, 'devTicket=T-1'))).toEqual({
      kind: 'signed-in',
      appUrl: 'openframe-console://auth?devTicket=T-1',
    });
  });

  it('hands an identity with no account on as its signup ticket', () => {
    expect(readDesktopAuthReturn(gatewayLanding(target, 'signupTicket=S-1'))).toEqual({
      kind: 'signup',
      appUrl: 'openframe-console://auth?signupTicket=S-1',
    });
  });

  it('hands an outcome code on under the param the app reads', () => {
    expect(readDesktopAuthReturn(gatewayLanding(target, 'error=USER_CANCELED'))).toEqual({
      kind: 'error',
      code: 'USER_CANCELED',
      appUrl: 'openframe-console://auth?error=USER_CANCELED',
    });
  });

  it('ends the login at once when the gateway landed the page with nothing', () => {
    const bare = { kind: 'incomplete', appUrl: 'openframe-console://auth' };

    expect(readDesktopAuthReturn(new URL(target))).toEqual(bare);
    expect(readDesktopAuthReturn(new URL(`${target}?unexpected=1`))).toEqual(bare);
  });

  it('does not forward an outcome that is not a code, since the app would show it in a toast', () => {
    expect(readDesktopAuthReturn(gatewayLanding(target, 'error=Call+us+at+555-0100'))).toEqual({
      kind: 'incomplete',
      appUrl: 'openframe-console://auth',
    });
  });

  it('launches nothing for a visit without a fragment, so a stray visit cannot end a waiting sign-in', () => {
    expect(readDesktopAuthReturn(new URL(`${SHARED_HOST}/auth/desktop-return/`))).toEqual({ kind: 'none' });
  });

  it('ignores a ticket in the query, where the browser would redeem it before the app', () => {
    expect(readDesktopAuthReturn(new URL(`${SHARED_HOST}/auth/desktop-return/?devTicket=T-1`))).toEqual({
      kind: 'none',
    });
  });

  it('forwards only the one value, to the constant scheme, encoded', () => {
    const handoff = readDesktopAuthReturn(
      new URL(`${target}?devTicket=a%26redirectTo%3Devil&scheme=evil&redirectTo=evil%3A%2F%2Fx`),
    );
    if (handoff.kind === 'none') throw new Error('expected a hand-off');
    const appUrl = new URL(handoff.appUrl);

    expect(appUrl.protocol).toBe(`${DESKTOP_APP_SCHEME}:`);
    expect([...appUrl.searchParams]).toEqual([['devTicket', 'a&redirectTo=evil']]);
  });
});

describe('landingLocation', () => {
  const target = desktopAuthReturnTarget(SHARED_HOST);
  const page = `${SHARED_HOST}/auth/desktop-return/`;
  /** The address bar after the app router's rewrite on hydration: a bare `#` is gone. */
  const rewritten = new URL(page);

  it('reads a bare landing from the navigation entry once the router has dropped the `#`', () => {
    expect(readDesktopAuthReturn(landingLocation(rewritten, { name: target }))).toEqual({
      kind: 'incomplete',
      appUrl: 'openframe-console://auth',
    });
  });

  it('reads the address while it still has a fragment, whatever the entry holds', () => {
    const landed = gatewayLanding(target, 'devTicket=T-1');

    expect(landingLocation(landed, { name: page })).toBe(landed);
  });

  it('ignores the entry of another page, which is what a client-side navigation here leaves', () => {
    expect(readDesktopAuthReturn(landingLocation(rewritten, { name: `${SHARED_HOST}/auth/#` }))).toEqual({
      kind: 'none',
    });
  });

  it('stays a stray visit on a reload after the strip, whose entry has no fragment', () => {
    expect(readDesktopAuthReturn(landingLocation(rewritten, { name: page }))).toEqual({ kind: 'none' });
  });

  it('reads the address when the browser has no navigation entry', () => {
    expect(landingLocation(rewritten, undefined)).toBe(rewritten);
  });
});

describe('the scheme URL the page launches', () => {
  // The shell routes only `<URI_SCHEME>://<AUTH_CALLBACK_HOST>` to the pending login. Drift is
  // silent: every desktop sign-in would hang until the shell's timeout.
  it('is the scheme and host the desktop shell registers', () => {
    const shell = readFileSync(resolve(import.meta.dirname, '../../../desktop/src-tauri/src/lib.rs'), 'utf8');
    const rustConst = (name: string) => shell.match(new RegExp(`const ${name}: &str = "([^"]+)"`))?.[1];
    const handoff = readDesktopAuthReturn(gatewayLanding(desktopAuthReturnTarget(SHARED_HOST), 'devTicket=T-1'));
    if (handoff.kind === 'none') throw new Error('expected a hand-off');

    expect(new URL(handoff.appUrl).protocol).toBe(`${rustConst('URI_SCHEME')}:`);
    expect(new URL(handoff.appUrl).host).toBe(rustConst('AUTH_CALLBACK_HOST'));
    expect(DESKTOP_APP_SCHEME).toBe(rustConst('URI_SCHEME'));
  });
});
