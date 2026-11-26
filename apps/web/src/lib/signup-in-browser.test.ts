/**
 * The app shells cannot get the reCAPTCHA token the edge asks of a password sign-up, so they hand the sign-up to the
 * shared host's page in the browser; a build with no shared host has no such rule and keeps the form.
 */

import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { openSignupInBrowser, signupContinuesInBrowser, signupInBrowserUrl } from './signup-in-browser';

const env = vi.hoisted(() => ({ shell: true, sharedHost: 'https://openframe.ai/' }));

vi.mock('./platform', () => ({ isAppShell: () => env.shell }));
vi.mock('./runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => env.sharedHost } }));

let open: MockInstance<typeof window.open>;

beforeEach(() => {
  env.shell = true;
  env.sharedHost = 'https://openframe.ai/';
  open = vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  open.mockRestore();
});

describe('signupContinuesInBrowser', () => {
  it('hands off in a shell with a shared host', () => {
    expect(signupContinuesInBrowser()).toBe(true);
  });

  it('keeps the form on the web', () => {
    env.shell = false;
    expect(signupContinuesInBrowser()).toBe(false);
  });

  it('keeps the form in a self-hosted shell, which has no shared host', () => {
    env.sharedHost = '';
    expect(signupContinuesInBrowser()).toBe(false);
  });
});

describe('signupInBrowserUrl', () => {
  it('is the shared host sign-up page with the email for its prefill', () => {
    expect(signupInBrowserUrl('kate+ops@acme.com')).toBe('https://openframe.ai/auth/?email=kate%2Bops%40acme.com');
  });

  it('has no query without an email', () => {
    expect(signupInBrowserUrl('')).toBe('https://openframe.ai/auth/');
  });
});

describe('openSignupInBrowser', () => {
  it('opens the page in a new window, which the shells route to the browser', () => {
    openSignupInBrowser('kate@acme.com');
    expect(open).toHaveBeenCalledWith(
      'https://openframe.ai/auth/?email=kate%40acme.com',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
