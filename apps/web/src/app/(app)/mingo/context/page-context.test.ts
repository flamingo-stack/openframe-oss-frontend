/**
 * What Mingo is told about the page a message is sent from: its kind and name, and on
 * a list, the list and the filters in its URL.
 */
import { describe, expect, it } from 'vitest';
import { PAGE_CONTEXT_LIMITS, pageContextHref, resolvePageContext } from './page-context';

const MACBOOK = { type: 'DEVICE' as const, id: 'm-1', label: 'MacBook' };

describe('resolvePageContext', () => {
  it("names Mingo's own pages", () => {
    expect(resolvePageContext('/mingo/', null)).toEqual({ currentPage: { kind: 'HOME', title: 'Home' } });
    expect(resolvePageContext('/mingo/archive/', null).currentPage).toEqual({
      kind: 'CHAT_ARCHIVE',
      title: 'Chat Archive',
    });
    expect(resolvePageContext('/approvals/', null).currentPage).toEqual({
      kind: 'NEEDS_APPROVAL',
      title: 'Needs approval',
    });
  });

  it('sends a list with the filters and search in its URL, OR within a field', () => {
    expect(resolvePageContext('/devices/?statuses=OFFLINE&statuses=PENDING&search=mac&viewMode=grid', null)).toEqual({
      currentPage: { kind: 'LIST', title: 'Devices' },
      currentList: {
        module: 'DEVICES',
        filters: [{ field: 'statuses', values: ['OFFLINE', 'PENDING'] }],
        search: 'mac',
      },
    });
  });

  it('sends an unfiltered list with no filters', () => {
    expect(resolvePageContext('/scripts/schedules/', null)).toEqual({
      currentPage: { kind: 'LIST', title: 'Schedules' },
      currentList: { module: 'SCRIPT_SCHEDULES', filters: [] },
    });
  });

  it('leaves out what orders a list rather than narrows it', () => {
    const { currentList } = resolvePageContext('/tickets/?sortDir=asc&viewMode=table&unread=true', null);
    expect(currentList).toEqual({ module: 'TICKETS', filters: [{ field: 'unread', values: ['true'] }] });
  });

  it("takes a tab that narrows the list as a filter, the page's default when the URL has none", () => {
    expect(resolvePageContext('/incidents/', null).currentList?.filters).toEqual([
      { field: 'tab', values: ['current'] },
    ]);
    expect(resolvePageContext('/customers/?tab=archived', null).currentList?.filters).toEqual([
      { field: 'tab', values: ['archived'] },
    ]);
  });

  it('tells the two Monitoring tabs apart', () => {
    expect(resolvePageContext('/monitoring/', null)).toMatchObject({
      currentPage: { kind: 'LIST', title: 'Policies' },
      currentList: { module: 'POLICIES' },
    });
    expect(resolvePageContext('/monitoring/?tab=queries', null)).toMatchObject({
      currentPage: { kind: 'LIST', title: 'Queries' },
      currentList: { module: 'QUERIES', filters: [] },
    });
  });

  it("names a list's archive as its section", () => {
    expect(resolvePageContext('/scripts/archived/', null)).toMatchObject({
      currentPage: { kind: 'LIST', title: 'Scripts', section: 'archive' },
      currentList: { module: 'SCRIPTS' },
    });
  });

  it('names an entity page after its open entity, and by its kind before it lands', () => {
    expect(resolvePageContext('/devices/details/?id=m-1', MACBOOK)).toEqual({
      currentPage: { kind: 'ENTITY', title: 'Device: MacBook' },
    });
    expect(resolvePageContext('/devices/details/?id=m-1', null).currentPage).toEqual({
      kind: 'ENTITY',
      title: 'Device',
    });
    // An entity of another page still open: not this page's.
    expect(resolvePageContext('/customers/details/?id=o-1', MACBOOK).currentPage.title).toBe('Customer');
  });

  it('sends the Settings tab or sub-page as the section', () => {
    expect(resolvePageContext('/settings/?tab=api-keys', null).currentPage).toEqual({
      kind: 'SETTINGS',
      title: 'Settings',
      section: 'api-keys',
    });
    expect(resolvePageContext('/settings/sso/', null).currentPage).toEqual({
      kind: 'SETTINGS',
      title: 'Settings',
      section: 'sso',
    });
    expect(resolvePageContext('/settings/', null).currentPage).toEqual({ kind: 'SETTINGS', title: 'Settings' });
  });

  it("sends any other page as OTHER, under its module's name", () => {
    expect(resolvePageContext('/scripts/new/', null).currentPage).toEqual({
      kind: 'OTHER',
      title: 'Scripts',
      section: 'new',
    });
    expect(resolvePageContext('/checkout/success/', null).currentPage).toEqual({ kind: 'OTHER', title: 'Checkout' });
  });

  it("keeps within the ai-agent's limits, which would reject the whole message", () => {
    const long = 'x'.repeat(500);
    const many = Array.from({ length: 60 }, (_, i) => `statuses=S${i}`).join('&');
    const fields = Array.from({ length: 30 }, (_, i) => `f${i}=v`).join('&');

    const { currentList } = resolvePageContext(`/devices/?search=${long}&tags=${long}&${many}&${fields}`, null);
    expect(currentList?.search).toHaveLength(PAGE_CONTEXT_LIMITS.search);
    expect(currentList?.filters).toHaveLength(PAGE_CONTEXT_LIMITS.filters);
    expect(currentList?.filters?.find(f => f.field === 'tags')?.values[0]).toHaveLength(PAGE_CONTEXT_LIMITS.value);
    expect(currentList?.filters?.find(f => f.field === 'statuses')?.values).toHaveLength(PAGE_CONTEXT_LIMITS.values);

    const entity = resolvePageContext('/devices/details/?id=m-1', { ...MACBOOK, label: long }).currentPage;
    expect(entity.title).toHaveLength(PAGE_CONTEXT_LIMITS.title);
    expect(resolvePageContext(`/settings/?tab=${long}`, null).currentPage.section).toHaveLength(
      PAGE_CONTEXT_LIMITS.section,
    );
  });
});

describe('pageContextHref', () => {
  it('is the page on screen', () => {
    expect(pageContextHref({ pathname: '/devices/', search: '?statuses=OFFLINE' }, '/tickets/')).toBe(
      '/devices/?statuses=OFFLINE',
    );
  });

  it("is the page a chat page was opened from, and Mingo's home without one", () => {
    expect(pageContextHref({ pathname: '/mingo/chat/', search: '?id=d-1' }, '/devices/?statuses=OFFLINE')).toBe(
      '/devices/?statuses=OFFLINE',
    );
    expect(pageContextHref({ pathname: '/mingo/chat/', search: '?id=d-1' }, null)).toBe('/mingo');
  });
});
