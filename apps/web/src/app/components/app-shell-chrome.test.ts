import { describe, expect, it } from 'vitest';
import {
  APP_MAIN_CLASS_NAME,
  getMainClassNameOverride,
  holdsDashboard,
  isBareChromeRoute,
  isLandingRoute,
  mingoHeaderLoadingCells,
} from './app-shell-chrome';

describe('mingoHeaderLoadingCells', () => {
  it('reserves the time tracker, notifications and Mingo: the phone top bar has no Chat history cell', () => {
    expect(mingoHeaderLoadingCells(true)).toEqual(['icon', 'icon', 'icon']);
    expect(mingoHeaderLoadingCells(false)).toEqual(['icon', 'icon']);
  });
});

describe('getMainClassNameOverride', () => {
  it('drops the bottom padding on the pages that fill <main>, the Mingo chat and archive included', () => {
    for (const pathname of [
      '/devices/details/file-manager',
      '/tickets',
      '/settings/sso',
      '/mingo/chat',
      '/mingo/chat/',
      '/mingo/archive',
      '/mingo/archive/',
    ]) {
      expect(getMainClassNameOverride(pathname), pathname).toBe('pb-0 md:pb-0');
    }
  });

  it('leaves every other page on the default padding', () => {
    for (const pathname of ['/mingo', '/mingo/', '/approvals', '/devices', '/dashboard']) {
      expect(getMainClassNameOverride(pathname), pathname).toBeUndefined();
    }
    expect(getMainClassNameOverride(null)).toBeUndefined();
    expect(APP_MAIN_CLASS_NAME).toBe('pb-14');
  });
});

describe('isLandingRoute / isBareChromeRoute', () => {
  it('matches the dashboard and Mingo home with and without the trailing slash, nothing deeper', () => {
    expect(isLandingRoute('/dashboard')).toBe(true);
    expect(isLandingRoute('/dashboard/')).toBe(true);
    expect(isLandingRoute('/mingo')).toBe(true);
    expect(isLandingRoute('/mingo/')).toBe(true);
    expect(isLandingRoute('/mingo/chat')).toBe(false);
    expect(isLandingRoute('/devices')).toBe(false);
    expect(isLandingRoute(null)).toBe(false);
  });

  it('treats the wizard and its sub-routes as bare chrome', () => {
    expect(isBareChromeRoute('/setup')).toBe(true);
    expect(isBareChromeRoute('/setup/anything')).toBe(true);
    expect(isBareChromeRoute('/dashboard')).toBe(false);
  });
});

describe('holdsDashboard', () => {
  it('holds the landing page while the onboarding answer is pending or points at the wizard', () => {
    expect(holdsDashboard('/dashboard', 'loading', 'unknown', false)).toBe(true);
    expect(holdsDashboard('/dashboard', 'on', 'unknown', false)).toBe(true);
    expect(holdsDashboard('/dashboard/', 'on', 'setup', false)).toBe(true);
    expect(holdsDashboard('/mingo', 'on', 'setup', false)).toBe(true);
  });

  it('releases it once the session is known to belong there', () => {
    expect(holdsDashboard('/dashboard', 'on', 'none', false)).toBe(false);
    expect(holdsDashboard('/mingo/', 'on', 'none', false)).toBe(false);
  });

  it('never holds with the flag off, on a locked workspace, or anywhere but the landing page', () => {
    expect(holdsDashboard('/dashboard', 'off', 'unknown', false)).toBe(false);
    expect(holdsDashboard('/dashboard', 'on', 'unknown', true)).toBe(false);
    expect(holdsDashboard('/devices', 'on', 'unknown', false)).toBe(false);
    expect(holdsDashboard('/mingo/chat', 'on', 'setup', false)).toBe(false);
    expect(holdsDashboard(null, 'on', 'setup', false)).toBe(false);
  });
});
