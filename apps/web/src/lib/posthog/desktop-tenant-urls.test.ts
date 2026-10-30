/**
 * Pins what a desktop event or recording says about where it came from: the tenant's origin while
 * signed in, the shared host otherwise, and never the app's own `tauri://` origin.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  stored: null as string | null,
  shared: 'https://openframe.ai',
}));

vi.mock('@/app/(auth)/auth/stores/auth-store', () => ({
  useAuthStore: { getState: () => ({ user: state.user }) },
}));
vi.mock('@/lib/native-shell', () => ({ getStoredTenantHost: () => state.stored }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { sharedHostUrl: () => state.shared } }));

import { moveToTenantOrigin } from './desktop-tenant-urls';

const BUNDLE = window.location.origin;
const BUNDLE_HOST = window.location.host;
const TENANT = 'https://acme.openframe.ai';

beforeEach(() => {
  state.user = { id: 'user-1' };
  state.stored = TENANT;
  state.shared = 'https://openframe.ai';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('moveToTenantOrigin', () => {
  it('moves the page URL and the host, keeping the path, query and hash', () => {
    const { properties } = moveToTenantOrigin({
      properties: {
        $current_url: `${BUNDLE}/devices/details/?id=1#files`,
        $host: BUNDLE_HOST,
        $pathname: '/devices/details/',
      },
    });
    expect(properties).toEqual({
      $current_url: `${TENANT}/devices/details/?id=1#files`,
      $host: 'acme.openframe.ai',
      $pathname: '/devices/details/',
    });
  });

  it('moves the copies the SDK derives, on the event and on the person', () => {
    const capture = moveToTenantOrigin({
      properties: { $session_entry_url: `${BUNDLE}/auth/`, $session_entry_host: BUNDLE_HOST },
      $set: { $current_url: `${BUNDLE}/dashboard/` },
      $set_once: { $initial_current_url: `${BUNDLE}/auth/`, $initial_host: BUNDLE_HOST },
    });
    expect(capture).toEqual({
      properties: { $session_entry_url: `${TENANT}/auth/`, $session_entry_host: 'acme.openframe.ai' },
      $set: { $current_url: `${TENANT}/dashboard/` },
      $set_once: { $initial_current_url: `${TENANT}/auth/`, $initial_host: 'acme.openframe.ai' },
    });
  });

  it('moves the page URLs inside a recording and leaves its compressed events alone', () => {
    const { properties } = moveToTenantOrigin({
      properties: {
        $snapshot_data: [
          { type: 4, data: { href: `${BUNDLE}/dashboard/`, width: 1280 } },
          { type: 5, data: { tag: '$pageview', payload: { href: `${BUNDLE}/devices/` } } },
          { type: 5, data: { tag: '$url_changed', payload: { href: `${BUNDLE}/logs-page/` } } },
          { type: 2, data: 'compressed', cv: '2024-10' },
          { type: 3 },
        ],
      },
    });
    expect(properties.$snapshot_data).toEqual([
      { type: 4, data: { href: `${TENANT}/dashboard/`, width: 1280 } },
      { type: 5, data: { tag: '$pageview', payload: { href: `${TENANT}/devices/` } } },
      { type: 5, data: { tag: '$url_changed', payload: { href: `${TENANT}/logs-page/` } } },
      { type: 2, data: 'compressed', cv: '2024-10' },
      { type: 3 },
    ]);
  });

  it('touches nothing that is not the app itself', () => {
    const properties = {
      $current_url: 'https://elsewhere.example/page',
      $lib_custom_api_host: 'https://us.i.posthog.com',
      $referrer: '$direct',
      device_name: BUNDLE_HOST,
      count: 3,
    };
    expect(moveToTenantOrigin({ properties: { ...properties } }).properties).toEqual(properties);
  });

  it('uses the shared host before sign-in', () => {
    state.user = null;
    state.stored = null;
    const { properties } = moveToTenantOrigin({ properties: { $current_url: `${BUNDLE}/auth/`, $host: BUNDLE_HOST } });
    expect(properties).toEqual({ $current_url: 'https://openframe.ai/auth/', $host: 'openframe.ai' });
  });

  it('does not name the tenant being left after a sign-out', () => {
    state.user = null;
    const { properties } = moveToTenantOrigin({ properties: { $current_url: `${BUNDLE}/auth/` } });
    expect(properties.$current_url).toBe('https://openframe.ai/auth/');
  });

  it('keeps the event as it is when no origin is known', () => {
    state.user = null;
    state.shared = '';
    const properties = { $current_url: `${BUNDLE}/auth/`, $host: BUNDLE_HOST };
    expect(moveToTenantOrigin({ properties: { ...properties } }).properties).toEqual(properties);
  });

  it('passes on a capture another hook dropped', () => {
    expect(moveToTenantOrigin(null)).toBeNull();
  });
});
