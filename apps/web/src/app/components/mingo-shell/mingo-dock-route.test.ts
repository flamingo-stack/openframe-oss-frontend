import { describe, expect, it } from 'vitest';
import { composerRouteOf, dockViewOf } from './mingo-dock-route';

describe('dockViewOf(…).floats', () => {
  it('lays the dock over plain pages and home, which run on under it', () => {
    expect(dockViewOf(composerRouteOf('/devices/')).floats).toBe(true);
    expect(dockViewOf(composerRouteOf('/mingo/')).floats).toBe(true);
  });

  it('lays it over a session recording and the script editor, which scroll like any page', () => {
    for (const pathname of ['/devices/details/remote-session/', '/scripts/new/', '/scripts/edit/']) {
      expect(composerRouteOf(pathname)).toBe('page');
      expect(dockViewOf(composerRouteOf(pathname)).floats).toBe(true);
    }
  });

  it('keeps it a band under the chat page and full-width pages', () => {
    expect(dockViewOf(composerRouteOf('/mingo/chat/')).floats).toBe(false);
    expect(dockViewOf(composerRouteOf('/devices/details/remote-desktop/')).floats).toBe(false);
  });
});
