/**
 * "Open Fae": the desktop shell hands the link to the OS through `window.open`,
 * a browser follows it itself, and a phone has no Fae to open.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const shell = vi.hoisted(() => ({ kind: 'web' as 'web' | 'desktop' | 'mobile' }));

vi.mock('./platform', () => ({
  isDesktopShell: () => shell.kind === 'desktop',
  isMobileShell: () => shell.kind === 'mobile',
}));

import { canOpenFaeApp, FAE_APP_URL, openFaeApp } from './fae-app';

afterEach(() => {
  shell.kind = 'web';
  vi.restoreAllMocks();
});

describe('openFaeApp', () => {
  it('opens the scheme the chat app claims', () => {
    expect(FAE_APP_URL).toBe('openframe-chat://open');
  });

  it('hands the link to the desktop shell as a new window', () => {
    shell.kind = 'desktop';
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openFaeApp();
    expect(open).toHaveBeenCalledWith(FAE_APP_URL, '_blank');
  });

  it('follows the link in a browser', () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign });
    const open = vi.spyOn(window, 'open');
    openFaeApp();
    expect(assign).toHaveBeenCalledWith(FAE_APP_URL);
    expect(open).not.toHaveBeenCalled();
  });

  it('is never offered on a phone', () => {
    expect(canOpenFaeApp()).toBe(true);
    shell.kind = 'desktop';
    expect(canOpenFaeApp()).toBe(true);
    shell.kind = 'mobile';
    expect(canOpenFaeApp()).toBe(false);
  });
});
