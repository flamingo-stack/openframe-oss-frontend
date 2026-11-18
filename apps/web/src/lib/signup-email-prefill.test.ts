import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { resetSignupEmailPrefill, signupEmailSeedScript, useSignupEmailPrefill } from '@/lib/signup-email-prefill';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** What the hook answers once mounted. */
function prefill(): string | null {
  let value: string | null | undefined;
  function Probe() {
    value = useSignupEmailPrefill();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
  act(() => root.unmount());
  return value ?? null;
}

function load(url: string) {
  window.history.replaceState({ kept: true }, '', url);
  new Function(signupEmailSeedScript())();
}

afterEach(() => {
  sessionStorage.clear();
  resetSignupEmailPrefill();
  window.history.replaceState(null, '', '/');
});

describe('signupEmailSeedScript', () => {
  it('takes the email off the sign-up address and keeps everything else', () => {
    load('/auth/?email=admin%40example.com&utm_source=ads#ph');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/auth/?utm_source=ads#ph');
    expect(window.history.state).toEqual({ kept: true });
    expect(sessionStorage.getItem('of_signup_email')).toBe('admin@example.com');
  });

  it('leaves every other page alone', () => {
    load('/auth/login/?email=admin%40example.com');
    expect(window.location.search).toBe('?email=admin%40example.com');
    expect(sessionStorage.length).toBe(0);
  });

  it('drops a value too long to be an address, and still clears the address', () => {
    load(`/auth/?email=${'a'.repeat(250)}%40example.com`);
    expect(window.location.search).toBe('');
    expect(sessionStorage.length).toBe(0);
  });
});

describe('useSignupEmailPrefill', () => {
  it('hands the email over once per page load and removes it from storage', () => {
    load('/auth/?email=admin%40example.com');
    expect(prefill()).toBe('admin@example.com');
    expect(sessionStorage.getItem('of_signup_email')).toBeNull();
    expect(prefill()).toBe('admin@example.com');
  });

  it('is null without one', () => {
    expect(prefill()).toBeNull();
  });
});
