/**
 * The shell variant: loading until the `mingo-first` flag answers, the per-user
 * "Classic layout" opt-out able only to turn the new shell OFF, and a development
 * override that never reaches a production build.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import {
  CLASSIC_LAYOUT_KEY,
  DEV_SHELL_OVERRIDE_KEY,
  getShellVariant,
  readClassicLayout,
  readDevShellOverride,
  resolveMingoFirstGate,
  resolveMingoV2ChatGate,
  resolveShellVariant,
  setClassicLayout,
  subscribeClassicLayout,
} from './shell-variant';

describe('resolveShellVariant', () => {
  it('stays loading until the flag answers, opt-out or not', () => {
    expect(resolveShellVariant('loading', false)).toBe('loading');
    expect(resolveShellVariant('loading', true)).toBe('loading');
  });

  it('is the new shell only when the flag is on and the user has not opted out', () => {
    expect(resolveShellVariant('on', false)).toBe('mingo');
    expect(resolveShellVariant('on', true)).toBe('classic');
  });

  it('cannot be turned ON by the opt-out', () => {
    expect(resolveShellVariant('off', false)).toBe('classic');
    expect(resolveShellVariant('off', true)).toBe('classic');
  });
});

describe('resolveMingoFirstGate', () => {
  it('replaces an answered value with the override', () => {
    expect(resolveMingoFirstGate('off', 'mingo')).toBe('on');
    expect(resolveMingoFirstGate('on', 'classic')).toBe('off');
    expect(resolveMingoFirstGate('on', null)).toBe('on');
  });

  it('never skips the wait for the flag', () => {
    expect(resolveMingoFirstGate('loading', 'mingo')).toBe('loading');
    expect(resolveMingoFirstGate('loading', 'classic')).toBe('loading');
  });
});

describe('resolveMingoV2ChatGate', () => {
  it('is on in the Mingo-first shell whatever mingo-v2 says', () => {
    expect(resolveMingoV2ChatGate('mingo', 'off')).toBe('on');
    expect(resolveMingoV2ChatGate('mingo', 'loading')).toBe('on');
  });

  it('follows mingo-v2 in the classic shell', () => {
    expect(resolveMingoV2ChatGate('classic', 'on')).toBe('on');
    expect(resolveMingoV2ChatGate('classic', 'off')).toBe('off');
    expect(resolveMingoV2ChatGate('classic', 'loading')).toBe('loading');
  });

  it('answers off only once both sides have', () => {
    expect(resolveMingoV2ChatGate('loading', 'off')).toBe('loading');
    expect(resolveMingoV2ChatGate('loading', 'on')).toBe('on');
  });
});

describe('storage and the imperative snapshot', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFeatureFlagsStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
    useFeatureFlagsStore.getState().reset();
  });

  it('is loading before the flags answer, then follows the flag', () => {
    expect(getShellVariant()).toBe('loading');
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: true }]);
    expect(getShellVariant()).toBe('mingo');
    useFeatureFlagsStore.getState().setFlags([]);
    expect(getShellVariant()).toBe('classic');
  });

  it('reads an absent flag (a tenant without it) as the classic shell', () => {
    useFeatureFlagsStore.getState().setLoaded();
    expect(getShellVariant()).toBe('classic');
  });

  it('lets the opt-out win over a flag that is on, and notifies subscribers in this tab', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: true }]);
    const listener = vi.fn();
    const unsubscribe = subscribeClassicLayout(listener);

    setClassicLayout(true);
    expect(window.localStorage.getItem(CLASSIC_LAYOUT_KEY)).toBe('true');
    expect(readClassicLayout()).toBe(true);
    expect(getShellVariant()).toBe('classic');
    expect(listener).toHaveBeenCalledTimes(1);

    setClassicLayout(false);
    expect(window.localStorage.getItem(CLASSIC_LAYOUT_KEY)).toBeNull();
    expect(getShellVariant()).toBe('mingo');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('honours the development override outside production, after the flags answer', () => {
    window.localStorage.setItem(DEV_SHELL_OVERRIDE_KEY, 'mingo');
    expect(readDevShellOverride()).toBe('mingo');
    expect(getShellVariant()).toBe('loading');
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: false }]);
    expect(getShellVariant()).toBe('mingo');
  });

  it('ignores the development override in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    window.localStorage.setItem(DEV_SHELL_OVERRIDE_KEY, 'mingo');
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: false }]);

    expect(readDevShellOverride()).toBeNull();
    expect(getShellVariant()).toBe('classic');
  });

  it('ignores a malformed override value', () => {
    window.localStorage.setItem(DEV_SHELL_OVERRIDE_KEY, 'yes');
    expect(readDevShellOverride()).toBeNull();
  });

  it('keeps the opt-out on top of a forced Mingo-first shell', () => {
    window.localStorage.setItem(DEV_SHELL_OVERRIDE_KEY, 'mingo');
    setClassicLayout(true);
    useFeatureFlagsStore.getState().setFlags([{ name: 'mingo-first', enabled: false }]);
    expect(getShellVariant()).toBe('classic');
  });

  it('reads as not opted out when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readClassicLayout()).toBe(false);
    expect(readDevShellOverride()).toBeNull();
    getItem.mockRestore();
  });
});
