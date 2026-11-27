/**
 * The desktop app's sign-up finishes in the browser: the hand-off link says where it began, and the tab keeps that for
 * the registration while the address loses it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSignupStartedIn,
  readSignupStartedIn,
  SIGNUP_STARTED_IN_STORAGE_KEY,
  signupStartedInSeedScript,
} from '@/lib/signup-started-in';

function load(url: string) {
  window.history.replaceState({ kept: true }, '', url);
  new Function(signupStartedInSeedScript())();
}

function address(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('signupStartedInSeedScript', () => {
  it('keeps the marker for this tab and takes it off the sign-up address, leaving everything else', () => {
    load('/auth/?email=admin%40example.com&started_in=desktop&utm_source=ads#ph');
    expect(address()).toBe('/auth/?email=admin%40example.com&utm_source=ads#ph');
    expect(window.history.state).toEqual({ kept: true });
    expect(sessionStorage.getItem(SIGNUP_STARTED_IN_STORAGE_KEY)).toBe('desktop');
  });

  it('reads the path without its trailing slash too', () => {
    load('/auth?started_in=desktop');
    expect(address()).toBe('/auth');
    expect(sessionStorage.getItem(SIGNUP_STARTED_IN_STORAGE_KEY)).toBe('desktop');
  });

  it('takes an unknown value off the address and keeps nothing', () => {
    load('/auth/?started_in=ios');
    expect(address()).toBe('/auth/');
    expect(sessionStorage.getItem(SIGNUP_STARTED_IN_STORAGE_KEY)).toBeNull();
  });

  it('leaves other pages alone', () => {
    load('/auth/login/?started_in=desktop');
    expect(address()).toBe('/auth/login/?started_in=desktop');
    expect(sessionStorage.getItem(SIGNUP_STARTED_IN_STORAGE_KEY)).toBeNull();
  });

  it('changes nothing on a sign-up page that carries no marker, and keeps the one the tab already has', () => {
    sessionStorage.setItem(SIGNUP_STARTED_IN_STORAGE_KEY, 'desktop');
    load('/auth/?utm_source=ads');
    expect(address()).toBe('/auth/?utm_source=ads');
    expect(sessionStorage.getItem(SIGNUP_STARTED_IN_STORAGE_KEY)).toBe('desktop');
  });

  it('still cleans the address when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    load('/auth/?started_in=desktop');
    expect(address()).toBe('/auth/');
  });
});

describe('readSignupStartedIn', () => {
  it('answers the kept marker', () => {
    sessionStorage.setItem(SIGNUP_STARTED_IN_STORAGE_KEY, 'desktop');
    expect(readSignupStartedIn()).toBe('desktop');
  });

  it('answers nothing without one, or for a value no app has', () => {
    expect(readSignupStartedIn()).toBeUndefined();
    sessionStorage.setItem(SIGNUP_STARTED_IN_STORAGE_KEY, 'web');
    expect(readSignupStartedIn()).toBeUndefined();
  });

  it('answers nothing, and does not throw, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readSignupStartedIn()).toBeUndefined();
  });
});

describe('clearSignupStartedIn', () => {
  it('forgets the marker', () => {
    sessionStorage.setItem(SIGNUP_STARTED_IN_STORAGE_KEY, 'desktop');
    clearSignupStartedIn();
    expect(readSignupStartedIn()).toBeUndefined();
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => clearSignupStartedIn()).not.toThrow();
  });
});
