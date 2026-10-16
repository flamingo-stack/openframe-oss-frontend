import { describe, expect, it } from 'vitest';
import { MINGO_DIALOG_PARAM, mingoDialogLink, routes, withMingoDialog } from './routes';

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
  it('is the chat route, which resolves in either shell', () => {
    // The Mingo-first shell shows the chat there; the classic shell redirects it to
    // the drawer's resting URL (`/dashboard?mingoDialog=`). A sender cannot know which
    // shell the recipient runs, so the link must be the one that works in both.
    expect(mingoDialogLink('d-1')).toBe('/mingo/chat?id=d-1');
    expect(mingoDialogLink('a b&c=1')).toBe('/mingo/chat?id=a+b%26c%3D1');
    expect(mingoDialogLink('d-1')).toBe(routes.mingo.chat('d-1'));
    expect(MINGO_DIALOG_PARAM).toBe('mingoDialog');
  });
});

describe('mingo', () => {
  it('builds the home, the chat page and the archive', () => {
    expect(routes.mingo.home).toBe('/mingo');
    expect(routes.mingo.chat('d-1')).toBe('/mingo/chat?id=d-1');
    expect(routes.mingo.archive).toBe('/mingo/archive');
  });

  it('puts the dialog id in `?id=`, never a path segment', () => {
    // Static export forbids dynamic segments, see ROUTES.md.
    expect(routes.mingo.chat(7)).toBe('/mingo/chat?id=7');
  });

  it('has an approvals page', () => {
    expect(routes.approvals).toBe('/approvals');
  });
});

/**
 * The filtered list builders write exactly what each page reads back through
 * `useApiParams`: arrays as one repeated key per value.
 */
describe('filtered lists', () => {
  it('narrows devices by status the way useDevicesUrlParams reads it', () => {
    expect(routes.devices.filtered({ statuses: ['PENDING'] })).toBe('/devices?statuses=PENDING');
    expect(routes.devices.filtered({ statuses: ['ONLINE', 'OFFLINE'] })).toBe(
      '/devices?statuses=ONLINE&statuses=OFFLINE',
    );
    expect(
      new URLSearchParams(routes.devices.filtered({ statuses: ['ONLINE', 'OFFLINE'] }).split('?')[1]).getAll(
        'statuses',
      ),
    ).toEqual(['ONLINE', 'OFFLINE']);
  });

  it('narrows devices by customer, with or without a status', () => {
    expect(routes.devices.filtered({ organizationIds: ['org-1'], statuses: ['ONLINE'] })).toBe(
      '/devices?organizationIds=org-1&statuses=ONLINE',
    );
    expect(routes.devices.filtered({ organizationIds: ['org 1'] })).toBe('/devices?organizationIds=org+1');
  });

  it('drops an empty filter, leaving the bare list', () => {
    expect(routes.devices.filtered({ organizationIds: [], statuses: [] })).toBe(routes.devices.list);
    expect(routes.devices.filtered({ statuses: [] })).toBe(routes.devices.list);
    expect(routes.devices.filtered({})).toBe('/devices');
    expect(routes.tickets.filtered({})).toBe(routes.tickets.list);
    expect(routes.incidents.filtered({ severity: [] })).toBe(routes.incidents.list);
  });

  it('narrows tickets by status id in the table view', () => {
    expect(routes.tickets.filtered({ status: ['s-1', 's 2'], viewMode: 'table' })).toBe(
      '/tickets?status=s-1&status=s+2&viewMode=table',
    );
    expect(routes.tickets.filtered({ viewMode: 'board' })).toBe('/tickets?viewMode=board');
  });

  it('narrows incidents by severity on a tab', () => {
    expect(routes.incidents.filtered({ severity: ['CRITICAL', 'HIGH'] })).toBe(
      '/incidents?severity=CRITICAL&severity=HIGH',
    );
    expect(routes.incidents.filtered({ tab: 'snoozed', severity: ['CRITICAL'] })).toBe(
      '/incidents?tab=snoozed&severity=CRITICAL',
    );
  });
});

describe('cloudTenantManagement', () => {
  it('builds the list and the create page as fixed paths', () => {
    expect(routes.cloudTenantManagement.list).toBe('/cloud-tenant-management');
    expect(routes.cloudTenantManagement.new()).toBe('/cloud-tenant-management/new');
    expect(routes.cloudTenantManagement.new({ id: 'tc-01' })).toBe('/cloud-tenant-management/new?id=tc-01');
  });

  it('puts the connection id in `?id=` on the detail, edit and reconnect pages', () => {
    // Static export forbids dynamic segments, see ROUTES.md.
    expect(routes.cloudTenantManagement.details('tc-01')).toBe('/cloud-tenant-management/details?id=tc-01');
    expect(routes.cloudTenantManagement.edit('tc-01')).toBe('/cloud-tenant-management/edit?id=tc-01');
    expect(routes.cloudTenantManagement.reconnect('tc-01')).toBe('/cloud-tenant-management/reconnect?id=tc-01');
  });

  it('encodes the id and accepts a numeric one', () => {
    expect(routes.cloudTenantManagement.details('a b&c=1')).toBe('/cloud-tenant-management/details?id=a+b%26c%3D1');
    expect(routes.cloudTenantManagement.details(7)).toBe('/cloud-tenant-management/details?id=7');
  });
});

describe('auth.error', () => {
  it('carries the reference as `ref` and nothing else', () => {
    // The page resolves `ref` through the auth server; there is no `error=<text>` form any more.
    expect(routes.auth.error()).toBe('/auth/error');
    expect(routes.auth.error({ ref: 'VERIFICATION_LINK_INVALID' })).toBe('/auth/error?ref=VERIFICATION_LINK_INVALID');
    expect(routes.auth.error({ ref: '7KQ2M9XD' })).toBe('/auth/error?ref=7KQ2M9XD');
  });
});
