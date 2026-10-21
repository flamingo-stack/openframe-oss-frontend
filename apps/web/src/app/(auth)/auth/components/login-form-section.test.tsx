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
const GENERIC_BUTTONS = ['Continue with Google', 'Continue with Microsoft', 'Continue with Apple'];

const ACME_TENANT = { tenantId: 't-1', tenantDomain: 'acme.openframe.ai' };

const ACME_CUSTOM: LoginDiscoveryResult = {
  found: true,
  tenant: ACME_TENANT,
  tenantName: 'Acme',
  openframe: true,
  customProviders: ['microsoft'],
};

const ACME_BUTTONS = ['Continue with OpenFrame', 'Continue with MicrosoftAcme'];

const NOT_FOUND: LoginDiscoveryResult = { found: false, tenant: null, openframe: false, customProviders: [] };

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

/** Types an address, looks it up at once and lets the answer land. */
async function lookUp(value: string) {
  type(value);
  pressEnter();
  await settle();
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
        domain: 'acme.openframe.ai',
        auth_providers: ['microsoft', 'google', 'apple', 'openframe'],
        openframe_login_enabled: false,
        custom_providers: ['microsoft'],
      }),
    ).toEqual({
      found: true,
      tenant: ACME_TENANT,
      tenantName: 'Acme',
      openframe: false,
      customProviders: ['microsoft'],
    });
  });

  it('keeps the custom providers in the generic order and drops ones the card has no button for', () => {
    expect(
      toLoginDiscoveryResult({
        email: 'kate@acme.com',
        has_existing_accounts: true,
        tenant_id: 't-1',
        openframe_login_enabled: true,
        custom_providers: ['okta', 'microsoft', 'google'],
      }).customProviders,
    ).toEqual(['google', 'microsoft']);
  });

  it('reads the null fields of an unknown address as no tenant', () => {
    expect(
      toLoginDiscoveryResult({
        email: 'dan@gmail.com',
        has_existing_accounts: false,
        tenant_id: null,
        openframe_login_enabled: null,
        custom_providers: null,
      }),
    ).toMatchObject({ found: false, tenant: null, customProviders: [] });
  });

  it("treats an older server's auth_providers as no custom SSO, since it mixes in the platform defaults", () => {
    expect(
      toLoginDiscoveryResult({
        email: 'kate@acme.com',
        has_existing_accounts: true,
        auth_providers: ['google', 'microsoft', 'openframe-sso'],
      }),
    ).toEqual({ found: true, tenant: null, tenantName: undefined, openframe: true, customProviders: [] });
    expect(
      toLoginDiscoveryResult({ email: 'kate@acme.com', has_existing_accounts: true, auth_providers: ['google'] })
        .openframe,
    ).toBe(false);
  });

  it("reads a 'localhost' domain as no host", () => {
    expect(
      toLoginDiscoveryResult({
        email: 'kate@acme.com',
        has_existing_accounts: true,
        tenant_id: 't-1',
        domain: 'localhost',
      }).tenant,
    ).toEqual({ tenantId: 't-1', tenantDomain: undefined });
  });
});

describe('LoginSection', () => {
  it('offers the generic providers, enabled, before anything is typed', () => {
    renderSection(vi.fn());
    expect(enabledNames()).toEqual(GENERIC_BUTTONS);
    expect(container.textContent).not.toContain('Sign-in methods for');
  });

  it("replaces them with only the tenant's own methods when it configured custom SSO", async () => {
    const onDiscover = vi.fn().mockResolvedValue(ACME_CUSTOM);
    const onSso = renderSection(onDiscover);

    await lookUp('kate@acme.com');

    expect(onDiscover).toHaveBeenCalledWith('kate@acme.com');
    expect(container.textContent).toContain('Sign-in methods for Acme');
    expect(enabledNames()).toEqual(ACME_BUTTONS);

    act(() => buttons()[1].click());
    expect(onSso).toHaveBeenCalledWith('microsoft', ACME_TENANT);
  });

  it('keeps the generic providers after OpenFrame when the tenant has no custom SSO, signing in to it', async () => {
    const onSso = renderSection(vi.fn().mockResolvedValue({ ...ACME_CUSTOM, customProviders: [] }));

    await lookUp('kate@acme.com');

    expect(enabledNames()).toEqual(['Continue with OpenFrame', ...GENERIC_BUTTONS]);

    act(() => buttons()[1].click());
    expect(onSso).toHaveBeenCalledWith('google', ACME_TENANT);
  });

  it('leaves OpenFrame out when the tenant turned it off', async () => {
    renderSection(vi.fn().mockResolvedValue({ ...ACME_CUSTOM, openframe: false }));

    await lookUp('kate@acme.com');

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
    expect(enabledNames()).toEqual(ACME_BUTTONS);
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

    await lookUp('kate@acme.com');
    type('kate@acme.co');

    expect(container.textContent).not.toContain('Sign-in methods for');
    expect(buttonNames()).toEqual(GENERIC_BUTTONS);
  });

  it('signs in to no tenant once a recognized address is cleared', async () => {
    const onSso = renderSection(vi.fn().mockResolvedValue(ACME_CUSTOM));

    await lookUp('kate@acme.com');
    type('');

    expect(enabledNames()).toEqual(GENERIC_BUTTONS);
    act(() => buttons()[0].click());
    expect(onSso).toHaveBeenCalledWith('google', null);
  });

  it('keeps the generic providers and says so when no account matches', async () => {
    renderSection(vi.fn().mockResolvedValue(NOT_FOUND));

    await lookUp('dan@gmail.com');

    expect(container.textContent).toContain('No account found for this email.');
    expect(enabledNames()).toEqual(GENERIC_BUTTONS);
  });

  it('looks a failed address up again on Enter, holding the providers until the retry answers', async () => {
    let answerRetry: (result: LoginDiscoveryResult) => void = () => {};
    const onDiscover = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() => new Promise(resolve => (answerRetry = resolve)));
    renderSection(onDiscover);

    await lookUp('kate@acme.com');
    expect(container.textContent).toContain('Failed to check your account.');
    expect(enabledNames()).toEqual(GENERIC_BUTTONS);

    pressEnter();
    await settle();
    expect(onDiscover).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Checking your account…'); // loading-standard-ok: asserts the field status
    expect(enabledNames()).toEqual([]);

    await act(async () => answerRetry(ACME_CUSTOM));
    await settle();
    expect(container.textContent).toContain('Sign-in methods for Acme');
  });

  it('looks an address up once when Enter beats the typing pause', async () => {
    vi.useFakeTimers();
    const onDiscover = vi.fn().mockResolvedValue(ACME_CUSTOM);
    renderSection(onDiscover);

    await lookUp('kate@acme.com');
    act(() => vi.advanceTimersByTime(400));
    await settle();

    expect(onDiscover).toHaveBeenCalledTimes(1);
  });

  it('ignores a late answer for an address the field has moved on from', async () => {
    let answerFirst: (result: LoginDiscoveryResult) => void = () => {};
    const onDiscover = vi
      .fn()
      .mockImplementationOnce(() => new Promise(resolve => (answerFirst = resolve)))
      .mockResolvedValueOnce(NOT_FOUND);
    renderSection(onDiscover);

    await lookUp('kate@acme.com');
    await lookUp('dan@gmail.com');
    await act(async () => answerFirst(ACME_CUSTOM));
    await settle();

    expect(container.textContent).not.toContain('Sign-in methods for');
    expect(container.textContent).toContain('No account found for this email.');
  });

  it('counts a lookup that never answers as failed', async () => {
    vi.useFakeTimers();
    renderSection(() => new Promise(() => {}));

    await lookUp('kate@acme.com');
    expect(enabledNames()).toEqual([]);

    act(() => vi.advanceTimersByTime(10_000));
    expect(container.textContent).toContain('Failed to check your account.');
    expect(enabledNames()).toEqual(GENERIC_BUTTONS);
  });

  it('treats a rejected lookup as a failed one instead of holding the providers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderSection(vi.fn().mockRejectedValue(new Error('boom')));

    await lookUp('kate@acme.com');

    expect(container.textContent).toContain('Failed to check your account.');
    expect(enabledNames()).toEqual(GENERIC_BUTTONS);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('shows the invitation notice instead on the login-only mobile build', async () => {
    shell.loginOnly = true;
    renderSection(vi.fn().mockResolvedValue(NOT_FOUND));

    await lookUp('dan@gmail.com');

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Ask them for an invitation.');
    expect(container.textContent).not.toContain('No account found for this email.');
  });
});
