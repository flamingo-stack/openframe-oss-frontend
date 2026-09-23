import { describe, expect, it } from 'vitest';
import {
  DEVICE_LOGS_REFRESH_PARAM,
  MINGO_DIALOG_PARAM,
  mingoDialogLink,
  routes,
  withDeviceLogsRefresh,
  withMingoDialog,
} from './routes';

/**
 * `withMingoDialog` writes the URL that `history.replaceState` puts in the address
 * bar verbatim — no router normalizes it afterwards. So what it preserves is the
 * contract: other params, the fragment, and the trailing slash the static export's
 * file host needs to resolve a reload.
 */
describe('withMingoDialog', () => {
  it('adds the param to a bare path and to one that already has a query', () => {
    expect(withMingoDialog('/dashboard', 'd-1')).toBe('/dashboard?mingoDialog=d-1');
    expect(withMingoDialog('/devices/details?id=m-1', 'd-1')).toBe('/devices/details?id=m-1&mingoDialog=d-1');
  });

  it('replaces an existing value rather than appending a second one', () => {
    expect(withMingoDialog('/dashboard?mingoDialog=old', 'new')).toBe('/dashboard?mingoDialog=new');
  });

  it('removes the param on null, and drops the `?` when nothing else is left', () => {
    expect(withMingoDialog('/dashboard?mingoDialog=d-1', null)).toBe('/dashboard');
    expect(withMingoDialog('/devices/details?id=m-1&mingoDialog=d-1', null)).toBe('/devices/details?id=m-1');
    expect(withMingoDialog('/dashboard', null)).toBe('/dashboard');
  });

  it('preserves the fragment', () => {
    // Real case: the help-center ticket deep link carries `#ticket-<id>`, and
    // opening Mingo on that page must not scroll the user somewhere else.
    expect(withMingoDialog('/help-center/tickets?ticket=t-1#ticket-t-1', 'd-1')).toBe(
      '/help-center/tickets?ticket=t-1&mingoDialog=d-1#ticket-t-1',
    );
    expect(withMingoDialog('/dashboard#section', null)).toBe('/dashboard#section');
  });

  it('preserves a trailing slash', () => {
    // Why this matters under `output: 'export'`: see the `withMingoDialog` JSDoc.
    expect(withMingoDialog('/dashboard/', 'd-1')).toBe('/dashboard/?mingoDialog=d-1');
  });

  it('encodes the id instead of pasting it into the query', () => {
    expect(withMingoDialog('/dashboard', 'a b&c=1')).toBe('/dashboard?mingoDialog=a+b%26c%3D1');
  });
});

describe('the canonical Mingo dialog deep link', () => {
  it('shares the drawer resting URL', () => {
    // The chat has no route of its own, so the shareable shape is the drawer's own
    // param on a fixed landing page — a pasted link adopts on arrival with nothing
    // rendered in between.
    expect(mingoDialogLink('d-1')).toBe('/dashboard?mingoDialog=d-1');
    expect(mingoDialogLink('a b&c=1')).toBe('/dashboard?mingoDialog=a+b%26c%3D1');
    expect(MINGO_DIALOG_PARAM).toBe('mingoDialog');
  });
});

describe('settings.tenant* (CU-86akj8ajt)', () => {
  it('builds the list and the create page as fixed paths', () => {
    expect(routes.settings.tenantManagement).toBe('/settings/tenant-management');
    expect(routes.settings.tenantNew).toBe('/settings/tenant-management/new');
  });

  it('puts the connection id in `?id=` on the detail, edit and reconnect pages', () => {
    // Static export forbids dynamic segments, see ROUTES.md.
    expect(routes.settings.tenantDetails('tc-01')).toBe('/settings/tenant-management/details?id=tc-01');
    expect(routes.settings.tenantEdit('tc-01')).toBe('/settings/tenant-management/edit?id=tc-01');
    expect(routes.settings.tenantReconnect('tc-01')).toBe('/settings/tenant-management/reconnect?id=tc-01');
  });

  it('encodes the id and accepts a numeric one', () => {
    expect(routes.settings.tenantDetails('a b&c=1')).toBe('/settings/tenant-management/details?id=a+b%26c%3D1');
    expect(routes.settings.tenantDetails(7)).toBe('/settings/tenant-management/details?id=7');
  });
});

describe('withDeviceLogsRefresh', () => {
  it('stamps the live URL without disturbing what is already on it', () => {
    expect(withDeviceLogsRefresh('/devices/details?id=m-1&tab=agent-logs', 1700000000000)).toBe(
      '/devices/details?id=m-1&tab=agent-logs&refresh=1700000000000',
    );
    expect(withDeviceLogsRefresh('/devices/details?id=m-1&logSearch=nats', 42)).toBe(
      '/devices/details?id=m-1&logSearch=nats&refresh=42',
    );
  });

  it('replaces an older stamp rather than appending a second one', () => {
    expect(withDeviceLogsRefresh('/devices/details?id=m-1&refresh=1', 2)).toBe('/devices/details?id=m-1&refresh=2');
  });

  it('clears the stamp on null, and keeps the fragment', () => {
    expect(withDeviceLogsRefresh('/devices/details?id=m-1&refresh=1#row', null)).toBe('/devices/details?id=m-1#row');
  });

  it('spells the param in exactly one place', () => {
    expect(DEVICE_LOGS_REFRESH_PARAM).toBe('refresh');
    expect(withDeviceLogsRefresh('/x', 1)).toContain(`${DEVICE_LOGS_REFRESH_PARAM}=1`);
  });
});
