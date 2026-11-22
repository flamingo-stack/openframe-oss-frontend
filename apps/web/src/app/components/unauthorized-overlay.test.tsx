// Pins the "Sign in required" overlay: Sign in always ends somewhere visible. A configured auth
// host is opened once, with the button pending until the page leaves (and enabled again after a
// bfcache Back, a failed navigation or a navigation that never leaves); a missing or invalid host
// shows an error instead of a silent no-op; every web tap is recorded; the native shell keeps its
// in-app sign-in.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/lib/routes';
import { buildSignInUrl, SIGN_IN_PENDING_TIMEOUT_MS, UnauthorizedOverlay } from './unauthorized-overlay';

const { replace, capture, env, shell } = vi.hoisted(() => ({
  replace: vi.fn(),
  capture: vi.fn(),
  env: { sharedHost: 'https://qa.openframe.build' },
  shell: { kind: 'web' },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/runtime-config', () => ({
  runtimeEnv: { authLoginUrl: () => env.sharedHost, appMode: () => 'saas-tenant' },
}));
vi.mock('@/lib/platform', () => ({ isAppShell: () => shell.kind !== 'web', shellKind: () => shell.kind }));
vi.mock('@/lib/posthog/posthog-events', () => ({ captureSignInRequiredClick: capture }));

const LOGIN = 'https://qa.openframe.build/auth/login/';

let container: HTMLDivElement;
let root: Root;
let assign: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

function render(preserveWorkspaceHint = false) {
  act(() => root.render(<UnauthorizedOverlay preserveWorkspaceHint={preserveWorkspaceHint} />));
}

function button(): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Sign in'));
  if (!found) throw new Error('Sign in button not rendered');
  return found;
}

function tap() {
  act(() => button().click());
}

function alertText(): string | null {
  return container.querySelector('[role="alert"]')?.textContent ?? null;
}

beforeEach(() => {
  env.sharedHost = 'https://qa.openframe.build';
  shell.kind = 'web';
  assign = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.useRealTimers();
  vi.restoreAllMocks();
  replace.mockReset();
  capture.mockReset();
});

describe('buildSignInUrl', () => {
  it("returns the auth host's Login tab, whatever trailing slashes the host has", () => {
    expect(buildSignInUrl('https://qa.openframe.build')).toBe(LOGIN);
    expect(buildSignInUrl('https://qa.openframe.build///')).toBe(LOGIN);
  });

  it('returns null for a missing, relative or non-http host', () => {
    expect(buildSignInUrl('')).toBeNull();
    expect(buildSignInUrl('qa.openframe.build')).toBeNull();
    expect(buildSignInUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('UnauthorizedOverlay', () => {
  it.each(['alpha.example.test', 'beta.example.test'])('keeps the workspace %s in the shared login tab', workspace => {
    window.location.search = `?workspace=${workspace}`;
    render(true);

    tap();

    expect(assign).toHaveBeenCalledExactlyOnceWith(`${LOGIN}?workspace=${workspace}`);
  });

  it('opens the auth host once and stays pending, however many taps follow', () => {
    render();
    tap();
    tap();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(LOGIN);
    expect(button().disabled).toBe(true);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith({
      app_mode: 'saas-tenant',
      shell: 'web',
      target_url: LOGIN,
      fallback: false,
    });
  });

  it('is enabled again when Back restores the page from the bfcache', () => {
    render();
    tap();
    expect(button().disabled).toBe(true);

    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });

    expect(button().disabled).toBe(false);
  });

  it('is enabled again when the page never leaves', () => {
    vi.useFakeTimers();
    render();
    tap();
    expect(button().disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SIGN_IN_PENDING_TIMEOUT_MS);
    });

    expect(button().disabled).toBe(false);
  });

  it('is enabled again when the navigation throws', () => {
    assign.mockImplementation(() => {
      throw new Error('blocked');
    });
    render();
    tap();

    expect(button().disabled).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it.each([
    ['missing', ''],
    ['invalid', 'qa.openframe.build'],
  ])('shows an error instead of navigating when the auth host is %s', (_label, host) => {
    env.sharedHost = host;
    render();
    tap();

    expect(assign).not.toHaveBeenCalled();
    expect(button().disabled).toBe(false);
    expect(alertText()).toContain('Sign-in is unavailable right now');
    expect(console.error).toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ target_url: null, fallback: true }));
  });

  it('keeps the in-app sign-in in the native shell, without a web navigation', () => {
    shell.kind = 'mobile';
    render();
    tap();

    expect(replace).toHaveBeenCalledWith(routes.auth.root);
    expect(assign).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(button().disabled).toBe(true);
  });
});
