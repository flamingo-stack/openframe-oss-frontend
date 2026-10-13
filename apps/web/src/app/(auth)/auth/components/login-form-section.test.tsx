/**
 * Pins which sign-in methods the login card offers for what discovery answers. The bug this guards:
 * a tenant with its own Google SSO rejects a sign-in through the platform's Google credentials, so
 * the generic button of a provider must not be on offer once the email resolved to such a tenant —
 * nor clickable while the answer for a typed email is still out.
 */

import type { AuthSsoProvider } from '@flamingo-stack/openframe-frontend-core/components/features';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type LoginDiscoveryResult, LoginSection, toLoginDiscoveryResult } from './login-form-section';

const shell = vi.hoisted(() => ({ loginOnly: false }));

vi.mock('@/app/hooks/use-login-only-mobile-shell', () => ({ useLoginOnlyMobileShell: () => shell.loginOnly }));

const GENERIC: AuthSsoProvider[] = ['google', 'microsoft', 'apple'];

const ACME_CUSTOM: LoginDiscoveryResult = {
  found: true,
  tenantName: 'Acme',
  openframe: true,
  customProviders: ['microsoft'],
};

let root: Root;
let container: HTMLDivElement;

const buttons = () => Array.from(container.querySelectorAll('button'));
const buttonNames = () => buttons().map(button => button.textContent);
const enabledNames = () =>
  buttons()
    .filter(button => !button.disabled)
    .map(button => button.textContent);
const input = () => container.querySelector('input') as HTMLInputElement;

function renderSection(onDiscover: (email: string) => Promise<LoginDiscoveryResult | null>, onSso = vi.fn()) {
  act(() => {
    root.render(<LoginSection onDiscover={onDiscover} onSso={onSso} genericProviders={GENERIC} />);
  });
  return onSso;
}

function type(value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setValue?.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressEnter() {
  act(() => {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
}

/** Lets a resolved lookup land and the card re-render from it. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  shell.loginOnly = false;
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('toLoginDiscoveryResult', () => {
  it('reads the custom providers and the OpenFrame toggle from the widened contract', () => {
    expect(
      toLoginDiscoveryResult({
        email: 'kate@acme.com',
        has_existing_accounts: true,
        tenant_id: 't-1',
        tenant_name: 'Acme',
        auth_providers: ['google', 'microsoft', 'openframe'],
        openframe_login: false,
        providers: { microsoft: true, google: false },
      }),
    ).toEqual({ found: true, tenantName: 'Acme', openframe: false, customProviders: ['microsoft'] });
  });

  it("treats an older server's auth_providers as no custom SSO, since it mixes in the platform defaults", () => {
    expect(
      toLoginDiscoveryResult({
        email: 'kate@acme.com',
        has_existing_accounts: true,
        auth_providers: ['google', 'microsoft', 'openframe-sso'],
      }),
    ).toEqual({ found: true, tenantName: undefined, openframe: true, customProviders: [] });
    expect(
      toLoginDiscoveryResult({ email: 'kate@acme.com', has_existing_accounts: true, auth_providers: ['google'] })
        .openframe,
    ).toBe(false);
  });
});

describe('LoginSection', () => {
  it('offers the generic providers, enabled, before anything is typed', () => {
    renderSection(vi.fn());
    expect(enabledNames()).toEqual(['Continue with Google', 'Continue with Microsoft', 'Continue with Apple']);
    expect(container.textContent).not.toContain('Sign-in methods for');
  });

  it("replaces them with only the tenant's own methods when it configured custom SSO", async () => {
    const onDiscover = vi.fn().mockResolvedValue(ACME_CUSTOM);
    const onSso = renderSection(onDiscover);

    type('kate@acme.com');
    pressEnter();
    await settle();

    expect(onDiscover).toHaveBeenCalledWith('kate@acme.com');
    expect(container.textContent).toContain('Sign-in methods for Acme');
    expect(enabledNames()).toEqual(['Continue with OpenFrame', 'Continue with MicrosoftAcme']);

    act(() => buttons()[1].click());
    expect(onSso).toHaveBeenCalledWith('microsoft');
  });

  it('keeps the generic providers after OpenFrame when the tenant has no custom SSO', async () => {
    renderSection(vi.fn().mockResolvedValue({ ...ACME_CUSTOM, customProviders: [] }));

    type('kate@acme.com');
    pressEnter();
    await settle();

    expect(enabledNames()).toEqual([
      'Continue with OpenFrame',
      'Continue with Google',
      'Continue with Microsoft',
      'Continue with Apple',
    ]);
  });

  it('leaves OpenFrame out when the tenant turned it off', async () => {
    renderSection(vi.fn().mockResolvedValue({ ...ACME_CUSTOM, openframe: false }));

    type('kate@acme.com');
    pressEnter();
    await settle();

    expect(buttonNames()).toEqual(['Continue with MicrosoftAcme']);
  });

  it('holds every provider while the typed address is being looked up', async () => {
    let answer: (result: LoginDiscoveryResult) => void = () => {};
    renderSection(() => new Promise(resolve => (answer = resolve)));

    type('kate@acme.com');
    expect(enabledNames()).toEqual([]);

    pressEnter();
    await settle();
    expect(enabledNames()).toEqual([]);

    await act(async () => answer(ACME_CUSTOM));
    await settle();
    expect(enabledNames()).toEqual(['Continue with OpenFrame', 'Continue with MicrosoftAcme']);
  });

  it('looks the address up after a typing pause without Enter', async () => {
    vi.useFakeTimers();
    const onDiscover = vi.fn().mockResolvedValue(ACME_CUSTOM);
    renderSection(onDiscover);

    type('kate@acme.com');
    act(() => vi.advanceTimersByTime(399));
    expect(onDiscover).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    await settle();
    expect(onDiscover).toHaveBeenCalledWith('kate@acme.com');
    expect(container.textContent).toContain('Sign-in methods for Acme');
  });

  it('goes back to the generic providers when the address changes', async () => {
    renderSection(vi.fn().mockResolvedValue(ACME_CUSTOM));

    type('kate@acme.com');
    pressEnter();
    await settle();
    type('kate@acme.co');

    expect(container.textContent).not.toContain('Sign-in methods for');
    expect(buttonNames()).toEqual(['Continue with Google', 'Continue with Microsoft', 'Continue with Apple']);
  });

  it('keeps the generic providers and says so when no account matches', async () => {
    renderSection(vi.fn().mockResolvedValue({ found: false, openframe: false, customProviders: [] }));

    type('dan@gmail.com');
    pressEnter();
    await settle();

    expect(container.textContent).toContain('No account found for this email.');
    expect(enabledNames()).toEqual(['Continue with Google', 'Continue with Microsoft', 'Continue with Apple']);
  });

  it('shows the invitation notice instead on the login-only mobile build', async () => {
    shell.loginOnly = true;
    renderSection(vi.fn().mockResolvedValue({ found: false, openframe: false, customProviders: [] }));

    type('dan@gmail.com');
    pressEnter();
    await settle();

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Ask them for an invitation.');
    expect(container.textContent).not.toContain('No account found for this email.');
  });
});
