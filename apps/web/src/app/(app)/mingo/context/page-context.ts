/**
 * The page a Mingo message is sent from, as the ai-agent's `currentPage` (what kind of
 * page and its name) and, on a list, `currentList` (which list and its filters). Read
 * from the URL at send time: list filters already live there (`useApiParams`), so no
 * page has to report anything, and a chat in the sheet is about the page under it.
 *
 * One table, by exact pathname. A page not in it is `OTHER`, named after its sidebar
 * module, never left out: Mingo still learns where the user is.
 */

import { type NavModuleId, navModuleLabel, navModuleOf } from '@/lib/navigation-config';
import { routes } from '@/lib/routes';
import type { ListModule, MessageListRef, MessagePageRef } from '../../tickets/services/ticket-service.types';
import { MINGO_CONTEXT_ENTITY_TYPES } from './context-sources';
import type { ContextEntityKind, ContextRefWithLabel } from './context-types';

/** The ai-agent's limits on these inputs: past one, the whole message is rejected. */
export const PAGE_CONTEXT_LIMITS = {
  title: 120,
  section: 64,
  search: 200,
  filters: 20,
  field: 64,
  values: 50,
  value: 256,
} as const;

export interface PageContext {
  currentPage: MessagePageRef;
  currentList?: MessageListRef;
}

interface ListPage {
  module: ListModule;
  nav: NavModuleId;
  /** A variant of the list, e.g. its archive. */
  section?: string;
  /** The `tab` param is a filter on this list, and this is its value when the URL has none. */
  tabFilter?: string;
}

const LIST_PAGES: Record<string, ListPage> = {
  '/devices': { module: 'DEVICES', nav: 'devices' },
  '/devices/archive': { module: 'DEVICES', nav: 'devices', section: 'archive' },
  '/customers': { module: 'CUSTOMERS', nav: 'organizations', tabFilter: 'active' },
  '/tickets': { module: 'TICKETS', nav: 'tickets' },
  '/tickets/archive': { module: 'TICKETS', nav: 'tickets', section: 'archive' },
  '/incidents': { module: 'INCIDENTS', nav: 'incidents', tabFilter: 'current' },
  '/scripts': { module: 'SCRIPTS', nav: 'scripts' },
  '/scripts/archived': { module: 'SCRIPTS', nav: 'scripts', section: 'archive' },
  '/scripts/schedules': { module: 'SCRIPT_SCHEDULES', nav: 'schedules' },
  '/scripts/schedules/archived': { module: 'SCRIPT_SCHEDULES', nav: 'schedules', section: 'archive' },
  '/logs-page': { module: 'LOGS', nav: 'logs' },
  '/software': { module: 'SOFTWARE', nav: 'software' },
  '/software/vulnerabilities': { module: 'VULNERABILITIES', nav: 'vulnerabilities' },
  '/knowledge-base': { module: 'KNOWLEDGE_BASE', nav: 'knowledge-base' },
  '/knowledge-base/archive': { module: 'KNOWLEDGE_BASE', nav: 'knowledge-base', section: 'archive' },
  '/cloud-tenant-management': { module: 'CLOUD_TENANTS', nav: 'integrations' },
  '/worktime': { module: 'TIME_ENTRIES', nav: 'worktime' },
};

/** Entity pages: their detail page registers the entity as `openView` (`useTrackOpenView`). */
const ENTITY_PAGES: Record<string, ContextEntityKind> = {
  '/devices/details': 'DEVICE',
  '/devices/details/remote-shell': 'DEVICE',
  '/devices/details/remote-desktop': 'DEVICE',
  '/devices/details/file-manager': 'DEVICE',
  '/devices/details/remote-session': 'DEVICE',
  '/customers/details': 'ORGANIZATION',
  '/scripts/details': 'SCRIPT',
  '/scripts/schedules/details': 'SCHEDULED_SCRIPT',
  '/monitoring/policy': 'POLICY',
  '/monitoring/query': 'QUERY',
  '/tickets/dialog': 'TICKET',
  '/incidents/details': 'INSIGHT',
  '/knowledge-base/details': 'KB_ARTICLE',
  '/knowledge-base/folders': 'KB_FOLDER',
  '/software/details': 'SOFTWARE',
  '/software/vulnerability': 'VULNERABILITY',
  '/settings/employees/details': 'USER',
};

/** Pages that are neither a list nor an entity, by the name their page shows. */
const NAMED_PAGES: Record<string, MessagePageRef> = {
  [routes.dashboard]: { kind: 'HOME', title: 'Dashboard' },
  // A new chat: about the whole workspace, as the dashboard is.
  [routes.mingo.home]: { kind: 'HOME', title: 'New chat' },
  [routes.mingo.archive]: { kind: 'CHAT_ARCHIVE', title: 'Chat Archive' },
  [routes.approvals]: { kind: 'NEEDS_APPROVAL', title: 'Needs approval' },
  [routes.notifications()]: { kind: 'OTHER', title: 'Notifications' },
  [routes.devices.remoteSessions]: { kind: 'OTHER', title: 'Remote Sessions' },
};

/** URL params that order or lay out a list rather than narrow it. */
const NOT_A_FILTER = new Set(['id', 'tab', 'viewMode', 'page', 'pageSize', 'cursor', 'limit', 'mingoDialog']);
const isSort = (key: string) => /sort/i.test(key);
const isSearch = (key: string) => /search$/i.test(key);

const SETTINGS_PATH = '/settings';
const CHAT_PATH = '/mingo/chat';

/** `trailingSlash: true` puts a slash after every path; compare without it. */
function trimSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function entityLabel(kind: string): string | undefined {
  return MINGO_CONTEXT_ENTITY_TYPES.find(type => type.type === kind)?.label;
}

function listOf(page: ListPage, query: URLSearchParams): MessageListRef {
  const filters = new Map<string, string[]>();
  let search: string | undefined;
  for (const [key, raw] of query) {
    const value = raw.trim();
    if (!value || NOT_A_FILTER.has(key) || isSort(key)) continue;
    if (isSearch(key)) {
      search = clip(value, PAGE_CONTEXT_LIMITS.search);
      continue;
    }
    const values = filters.get(key) ?? [];
    values.push(clip(value, PAGE_CONTEXT_LIMITS.value));
    filters.set(key, values);
  }
  if (page.tabFilter) filters.set('tab', [query.get('tab') || page.tabFilter]);

  const list: MessageListRef = {
    module: page.module,
    filters: [...filters]
      .filter(([field]) => field.length <= PAGE_CONTEXT_LIMITS.field)
      .slice(0, PAGE_CONTEXT_LIMITS.filters)
      .map(([field, values]) => ({ field, values: values.slice(0, PAGE_CONTEXT_LIMITS.values) })),
  };
  if (search) list.search = search;
  return list;
}

function pageRef(kind: MessagePageRef['kind'], title: string, section?: string | null): MessagePageRef {
  const ref: MessagePageRef = { kind, title: clip(title, PAGE_CONTEXT_LIMITS.title) };
  if (section) ref.section = clip(section, PAGE_CONTEXT_LIMITS.section);
  return ref;
}

/**
 * The page context of `href` (a path with its query). `openView` names the entity of
 * an entity page ("Device: MacBook"); without it, or for another entity, the page is
 * named by its kind alone ("Device").
 */
export function resolvePageContext(href: string, openView: ContextRefWithLabel | null): PageContext {
  const url = new URL(href, 'http://local');
  const pathname = trimSlash(url.pathname);
  const query = url.searchParams;

  const named = NAMED_PAGES[pathname];
  if (named) return { currentPage: named };

  if (pathname === '/monitoring') {
    const queries = query.get('tab') === 'queries';
    const list: ListPage = queries ? { module: 'QUERIES', nav: 'queries' } : { module: 'POLICIES', nav: 'policies' };
    return { currentPage: pageRef('LIST', navModuleLabel(list.nav)), currentList: listOf(list, query) };
  }

  const list = LIST_PAGES[pathname];
  if (list) {
    return { currentPage: pageRef('LIST', navModuleLabel(list.nav), list.section), currentList: listOf(list, query) };
  }

  const entity = ENTITY_PAGES[pathname];
  if (entity) {
    const kindLabel = entityLabel(entity) ?? entity;
    const title = openView?.type === entity ? `${kindLabel}: ${openView.label}` : kindLabel;
    return { currentPage: pageRef('ENTITY', title) };
  }

  if (pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`)) {
    const sub = pathname.slice(SETTINGS_PATH.length + 1);
    return { currentPage: pageRef('SETTINGS', navModuleLabel('settings'), query.get('tab') ?? (sub || null)) };
  }

  // Any other page (a create or edit form, the Help Center): its module's name and
  // where in it, e.g. Scripts · new.
  const nav = navModuleOf(pathname);
  if (nav) {
    const prefix = pathname.split('/')[1] ?? '';
    const rest = pathname.slice(prefix.length + 2);
    return { currentPage: pageRef('OTHER', navModuleLabel(nav), rest || null) };
  }
  const segment = pathname.split('/').find(Boolean) ?? '';
  const title = segment ? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ') : 'Home';
  return { currentPage: pageRef('OTHER', title) };
}

/**
 * Which page a message is about: the one on screen, the page under the sheet
 * included. The chat page is the chat itself, so it is about the page it was opened
 * from (`lastPage`, where "Back to page" leads), and Mingo's home when there is none.
 *
 * A phone (`phone`) opens a chat from the chat list over a page, and a new one starts on
 * Mingo's home: there the home, and a chat page whose last page is the home, are about
 * the page the list was opened over (`outsidePage`), the page Mingo's × leads back to.
 */
export function pageContextHref(
  location: { pathname: string; search: string },
  lastPage: string | null,
  phone?: { outsidePage: string | null },
): string {
  const path = trimSlash(location.pathname);
  const home = routes.mingo.home;
  if (path === CHAT_PATH) {
    const opener = lastPage !== null && trimSlash(lastPage.split('?')[0]) !== home ? lastPage : null;
    return opener ?? phone?.outsidePage ?? lastPage ?? home;
  }
  if (path === home && phone) return phone.outsidePage ?? home;
  return `${location.pathname}${location.search}`;
}

/** Whether `href` is Mingo's home: no page to tell Mingo about. */
export function isMingoHomeHref(href: string): boolean {
  return trimSlash(href.split('?')[0]) === routes.mingo.home;
}
