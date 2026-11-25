import { afterEach, describe, expect, it, vi } from 'vitest';
import { composerRouteOf, dockViewOf, showsDockQuickActions } from './mingo-dock-route';

const { mode } = vi.hoisted(() => ({ mode: { saas: false } }));
vi.mock('@/lib/app-mode', async importOriginal => ({
  ...(await importOriginal<object>()),
  isSaasTenantMode: () => mode.saas,
}));

afterEach(() => {
  mode.saas = false;
});

describe('dockViewOf(…).floats', () => {
  it('lays the dock over plain pages, which run on under it', () => {
    expect(dockViewOf(composerRouteOf('/devices/')).floats).toBe(true);
    expect(dockViewOf(composerRouteOf('/dashboard/')).floats).toBe(true);
  });

  it('lays it over a session recording and the script editor, which scroll like any page', () => {
    for (const pathname of ['/devices/details/remote-session/', '/scripts/new/', '/scripts/edit/']) {
      expect(composerRouteOf(pathname)).toBe('page');
      expect(dockViewOf(composerRouteOf(pathname)).floats).toBe(true);
    }
  });

  it('keeps it a band under a new chat, the chat page and full-width pages', () => {
    expect(dockViewOf(composerRouteOf('/mingo/')).floats).toBe(false);
    expect(dockViewOf(composerRouteOf('/mingo/chat/')).floats).toBe(false);
    expect(dockViewOf(composerRouteOf('/devices/details/remote-desktop/')).floats).toBe(false);
  });
});

describe('showsDockQuickActions', () => {
  it("draws the quick actions over the dock on Mingo's home and every page", () => {
    for (const pathname of ['/mingo/', '/devices/', '/dashboard/', '/tickets/', '/help-center/tickets/']) {
      expect(showsDockQuickActions(composerRouteOf(pathname))).toBe(true);
    }
  });

  it('leaves them out on the chat page and on full-width pages', () => {
    for (const pathname of ['/mingo/chat/', '/devices/details/file-manager/', '/devices/details/remote-desktop/']) {
      expect(showsDockQuickActions(composerRouteOf(pathname))).toBe(false);
    }
  });
});

/**
 * The saas-gateway lands a login whose user has not finished the tour on `/onboarding`, which a SaaS
 * tenant forwards to Mingo's home: drawn as a page until then, it was an empty "Onboarding" column
 * beside Start Work (CU-17tkuw69uzp).
 */
describe("a SaaS tenant's /onboarding", () => {
  it("is Mingo's home for the dock, with and without the trailing slash", () => {
    mode.saas = true;
    expect(composerRouteOf('/onboarding')).toBe('home');
    expect(composerRouteOf('/onboarding/')).toBe('home');
    expect(composerRouteOf('/onboarding/x/')).toBe('page');
  });

  it('stays an ordinary page on an OSS tenant, where it is the Get Started tour', () => {
    expect(composerRouteOf('/onboarding/')).toBe('page');
  });
});
