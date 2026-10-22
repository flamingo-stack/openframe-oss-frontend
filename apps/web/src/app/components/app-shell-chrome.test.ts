import { describe, expect, it } from 'vitest';
import { holdsDashboard, isBareChromeRoute, isDashboardRoute } from './app-shell-chrome';

describe('isDashboardRoute / isBareChromeRoute', () => {
  it('matches the dashboard with and without the trailing slash, nothing deeper', () => {
    expect(isDashboardRoute('/dashboard')).toBe(true);
    expect(isDashboardRoute('/dashboard/')).toBe(true);
    expect(isDashboardRoute('/devices')).toBe(false);
    expect(isDashboardRoute(null)).toBe(false);
  });

  it('treats the wizard and its sub-routes as bare chrome', () => {
    expect(isBareChromeRoute('/setup')).toBe(true);
    expect(isBareChromeRoute('/setup/anything')).toBe(true);
    expect(isBareChromeRoute('/dashboard')).toBe(false);
  });
});

describe('holdsDashboard', () => {
  it('holds the dashboard while the onboarding answer is pending or points at the wizard', () => {
    expect(holdsDashboard('/dashboard', 'loading', 'unknown', false)).toBe(true);
    expect(holdsDashboard('/dashboard', 'on', 'unknown', false)).toBe(true);
    expect(holdsDashboard('/dashboard/', 'on', 'setup', false)).toBe(true);
  });

  it('releases it once the session is known to belong on the dashboard', () => {
    expect(holdsDashboard('/dashboard', 'on', 'none', false)).toBe(false);
  });

  it('never holds with the flag off, on a locked workspace, or anywhere but the dashboard', () => {
    expect(holdsDashboard('/dashboard', 'off', 'unknown', false)).toBe(false);
    expect(holdsDashboard('/dashboard', 'on', 'unknown', true)).toBe(false);
    expect(holdsDashboard('/devices', 'on', 'unknown', false)).toBe(false);
    expect(holdsDashboard(null, 'on', 'setup', false)).toBe(false);
  });
});
