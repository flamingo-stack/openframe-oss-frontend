/** The super user strip's room before paint: `<html>` is marked only for a stored super user. */

import { afterEach, describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY, SUPER_USER_SEED_ATTRIBUTE, superUserSeedScript } from './super-user-seed';

function seed(stored?: string): boolean {
  if (stored !== undefined) window.localStorage.setItem(AUTH_STORAGE_KEY, stored);
  // The script is ours, built from constants: what runs in `<head>` runs here.
  new Function(superUserSeedScript())();
  return document.documentElement.hasAttribute(SUPER_USER_SEED_ATTRIBUTE);
}

const persisted = (user: unknown) => JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 });

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(SUPER_USER_SEED_ATTRIBUTE);
});

describe('superUserSeedScript', () => {
  it('marks <html> when the stored session was a super user', () => {
    expect(seed(persisted({ id: 'u-1', isSuperUser: true }))).toBe(true);
  });

  it('marks nothing for a tenant user, no stored session, or a broken entry', () => {
    expect(seed(persisted({ id: 'u-1', isSuperUser: false }))).toBe(false);
    expect(seed(persisted({ id: 'u-1' }))).toBe(false);
    expect(seed(persisted(null))).toBe(false);
    expect(seed()).toBe(false);
    expect(seed('not json')).toBe(false);
    expect(seed(persisted({ id: 'u-1', isSuperUser: 'true' }))).toBe(false);
  });
});
