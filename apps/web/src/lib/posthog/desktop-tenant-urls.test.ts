/**
 * Pins the page a desktop event, recording or heatmap reports: the tenant's origin while signed in,
 * the shared host otherwise. The bundle origins are literals because `tauri://` is not a special URL
 * scheme: per the URL spec `new URL('tauri://localhost/x').origin` is `'null'`, so code going through
 * `URL` could pass on jsdom's `http://` origin and stop moving anything in the app.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ user: null as { id: string } | null, tenant: '', shared: '' }));

vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ user: state.user }) },
}));
vi.mock('@/lib/runtime-config', () => ({
  runtimeEnv: { tenantHostUrl: () => state.tenant, sharedHostUrl: () => state.shared },
}));

import { moveToTenantOrigin } from './desktop-tenant-urls';

const TENANT_HOST = 'acme.openframe.ai';
const TENANT = `https://${TENANT_HOST}`;
const SHARED_HOST = 'openframe.ai';
const SHARED = `https://${SHARED_HOST}`;

describe.each([
  { platform: 'macOS and Linux', bundle: 'tauri://localhost', bundleHost: 'localhost' },
  { platform: 'Windows', bundle: 'http://tauri.localhost', bundleHost: 'tauri.localhost' },
])('moveToTenantOrigin on $platform', ({ bundle, bundleHost }) => {
  beforeEach(() => {
    state.user = { id: 'user-1' };
    state.tenant = TENANT;
    state.shared = SHARED;
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, origin: bundle, host: bundleHost });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('moves the page URL and the host, keeping the path, query and hash', () => {
    const { properties } = moveToTenantOrigin({
      properties: {
        $current_url: `${bundle}/devices/details/?id=1#files`,
        $host: bundleHost,
        $pathname: '/devices/details/',
      },
    });
    expect(properties).toEqual({
      $current_url: `${TENANT}/devices/details/?id=1#files`,
      $host: TENANT_HOST,
      $pathname: '/devices/details/',
    });
  });

  it('moves the copies the SDK derives, on the event and on the person', () => {
    const capture = moveToTenantOrigin({
      properties: {
        $session_entry_url: `${bundle}/auth/`,
        $session_entry_host: bundleHost,
        $session_entry_referrer: `${bundle}/auth/`,
        $session_entry_referring_domain: bundleHost,
        $snapshot_host: bundleHost,
      },
      $set: { $current_url: `${bundle}/dashboard/`, $referrer: `${bundle}/auth/`, $referring_domain: bundleHost },
      $set_once: {
        $initial_current_url: `${bundle}/auth/`,
        $initial_host: bundleHost,
        $initial_referring_domain: bundleHost,
      },
    });
    expect(capture).toEqual({
      properties: {
        $session_entry_url: `${TENANT}/auth/`,
        $session_entry_host: TENANT_HOST,
        $session_entry_referrer: `${TENANT}/auth/`,
        $session_entry_referring_domain: TENANT_HOST,
        $snapshot_host: TENANT_HOST,
      },
      $set: {
        $current_url: `${TENANT}/dashboard/`,
        $referrer: `${TENANT}/auth/`,
        $referring_domain: TENANT_HOST,
      },
      $set_once: {
        $initial_current_url: `${TENANT}/auth/`,
        $initial_host: TENANT_HOST,
        $initial_referring_domain: TENANT_HOST,
      },
    });
  });

  it('moves the page URLs inside a recording and leaves its compressed events alone', () => {
    const { properties } = moveToTenantOrigin({
      properties: {
        $snapshot_data: [
          { type: 3, data: { source: 2 } },
          { type: 3 },
          { type: 2, data: 'compressed', cv: '2024-10' },
          { type: 4, data: { href: `${bundle}/dashboard/`, width: 1280 } },
          { type: 5, data: { tag: '$json_ld', href: `${bundle}/devices/` } },
        ],
      },
    });
    expect(properties.$snapshot_data).toEqual([
      { type: 3, data: { source: 2 } },
      { type: 3 },
      { type: 2, data: 'compressed', cv: '2024-10' },
      { type: 4, data: { href: `${TENANT}/dashboard/`, width: 1280 } },
      { type: 5, data: { tag: '$json_ld', href: `${TENANT}/devices/` } },
    ]);
  });

  it('moves the pages a heatmap is keyed by, keeping each page apart', () => {
    const devices = [{ x: 1, y: 2 }];
    const logs = [{ x: 3, y: 4 }];
    const elsewhere = [{ x: 5, y: 6 }];
    const { properties } = moveToTenantOrigin({
      properties: {
        $heatmap_data: {
          [`${bundle}/devices/`]: devices,
          [`${bundle}/logs-page/`]: logs,
          'https://elsewhere.example/page': elsewhere,
        },
      },
    });
    expect(properties.$heatmap_data).toEqual({
      [`${TENANT}/devices/`]: devices,
      [`${TENANT}/logs-page/`]: logs,
      'https://elsewhere.example/page': elsewhere,
    });
  });

  it('touches nothing that is not the app itself', () => {
    const properties = {
      $current_url: 'https://elsewhere.example/page',
      $external_click_url: `https://elsewhere.example/?next=${bundle}/devices/`,
      $lib_custom_api_host: 'https://us.i.posthog.com',
      $referrer: '$direct',
      device_name: bundleHost,
      count: 3,
    };
    expect(moveToTenantOrigin({ properties: { ...properties } }).properties).toEqual(properties);
  });

  it('uses the shared host while signed out, not the tenant last signed in to', () => {
    state.user = null;
    const { properties } = moveToTenantOrigin({ properties: { $current_url: `${bundle}/auth/`, $host: bundleHost } });
    expect(properties).toEqual({ $current_url: `${SHARED}/auth/`, $host: SHARED_HOST });
  });

  it('uses the shared host when signed in with no tenant host known', () => {
    state.tenant = '';
    const { properties } = moveToTenantOrigin({ properties: { $current_url: `${bundle}/dashboard/` } });
    expect(properties.$current_url).toBe(`${SHARED}/dashboard/`);
  });

  it('keeps the port of a tenant host', () => {
    state.tenant = 'https://acme.example:8443';
    const { properties } = moveToTenantOrigin({
      properties: { $current_url: `${bundle}/devices/`, $host: bundleHost },
    });
    expect(properties).toEqual({ $current_url: 'https://acme.example:8443/devices/', $host: 'acme.example:8443' });
  });

  it('keeps the event as it is when no origin is known', () => {
    state.user = null;
    state.shared = '';
    const properties = { $current_url: `${bundle}/auth/`, $host: bundleHost };
    expect(moveToTenantOrigin({ properties: { ...properties } }).properties).toEqual(properties);
  });
});
