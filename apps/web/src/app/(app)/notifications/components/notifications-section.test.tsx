/**
 * The notifications list follows the app's one table flag: the grid table where it is on, card rows where it is off,
 * loading rows until it is answered (and no read of the list meanwhile). In the grid each of the two lists keeps the
 * viewer's column layout under its own key, the page stays the scroll area, and the two buttons are action columns.
 */

import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';

interface SeenTable {
  layout?: string;
  maxHeight?: unknown;
  settings?: { storageKey?: string };
}

/** What the section handed its table, and whether the list was read. */
const seen = vi.hoisted(() => ({ table: null as SeenTable | null, reads: 0 }));

vi.mock('@/app/components/shared/live-table', async importOriginal => {
  const actual = await importOriginal<{ LiveTable: (props: SeenTable) => unknown }>();
  return {
    ...actual,
    LiveTable: (props: SeenTable) => {
      seen.table = props;
      return actual.LiveTable(props);
    },
  };
});

// The Relay tags need the Babel transform vitest does not run; a read of the list is counted, and refused.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  usePreloadedQuery: () => {
    seen.reads += 1;
    throw new Error('the list was read');
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => '/notifications',
  useSearchParams: () => new URLSearchParams(),
}));

const tenant = vi.hoisted(() => ({ host: 'https://acme.openframe.ai' }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => tenant.host } }));
vi.mock('@/app/components/notifications/open-mingo-dialog', () => ({
  canOpenMingoDialogOverPage: () => false,
  openMingoDialog: vi.fn(),
}));

import { resolveNotificationAction } from '@/app/components/notifications/notification-navigation';
import type { NotificationRow } from './notifications-columns';
import { NotificationsSection, SectionTableView } from './notifications-section';

const NOTIFICATION = {
  id: 'n-1',
  title: 'New release',
  createdAt: 0,
  read: false,
  category: 'GENERIC',
  type: 'Announcement',
  meta: { notificationType: 'ANNOUNCEMENT', link: 'https://acme.openframe.ai/devices' },
} as Notification;

const ROWS: NotificationRow[] = [
  {
    id: 'n-1',
    title: 'New release',
    description: 'Version 1.5.81 is out.',
    createdAt: 0,
    read: false,
    archived: false,
    notification: NOTIFICATION,
  },
];

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};

async function list(rowVariant: 'unread' | 'read' = 'unread') {
  const mounted = mount(
    <SectionTableView rows={ROWS} rowVariant={rowVariant} searchValue="" stickyHeaderOffset="0px" />,
  );
  await settle();
  return mounted.container;
}

beforeEach(() => {
  stubLayoutApis();
  seen.table = null;
  seen.reads = 0;
});

afterEach(() => {
  unmountAll();
  answerTableFlag('loading');
  window.localStorage.clear();
});

describe('the notifications list', () => {
  const label = resolveNotificationAction(NOTIFICATION)?.label ?? '';

  it('flag off: card rows, the open button with its label', async () => {
    answerTableFlag('off');
    const container = await list();

    expect(label).not.toBe('');
    expect(container.textContent).toContain('New release');
    expect(container.textContent).toContain(label);
    expect(hasGridMarkup(container)).toBe(false);
    expect(seen.table?.layout).toBe('cards');
    expect(seen.table?.settings).toBeUndefined();
  });

  it('flag on: the grid table with a gear, the page as its scroll area, the buttons in action columns', async () => {
    answerTableFlag('on');
    const container = await list();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['notification', 'details']);
    expect(container.textContent).toContain('New release');
    expect(container.textContent).toContain('Version 1.5.81 is out.');
    expect(gridSettingsGear(container)).not.toBeNull();
    expect(gridViewport(container)).toBeNull();
    expect(seen.table?.maxHeight).toBeUndefined();
    // The count is drawn once, above the table: the grid header does not draw the card header's right slot.
    expect((container.textContent ?? '').match(/1 result/g)).toHaveLength(1);
    // The open action is a bare icon button: its label is its name, not text in the row.
    expect(container.textContent).not.toContain(label);
    expect(container.querySelector(`a[aria-label="${label}"]`)?.className).toContain('border-0');
    expect(container.querySelector('button[aria-label="Mark as done"]')?.className).toContain('border-0');
  });

  it('keeps the column layout of each list under its own key', async () => {
    answerTableFlag('on');
    await list('unread');
    expect(seen.table?.settings?.storageKey).toBe('notifications-unread');

    unmountAll();
    await list('read');
    expect(seen.table?.settings?.storageKey).toBe('notifications-read');
  });

  it('hands the approval block to the grid’s sub-row, which keeps it as wide as the visible table', async () => {
    const loadingList = (
      <LoadingWhen loading>
        <SectionTableView rows={[]} rowVariant="unread" searchValue="" stickyHeaderOffset="0px" />
      </LoadingWhen>
    );
    answerTableFlag('on');
    const grid = mount(loadingList);
    await settle();
    expect(gridRoot(grid.container)).not.toBeNull();
    // The table's own sub-row box (the lib's, from 0.0.911): no width of its own, sticky to the visible table.
    const subRow = grid.container.querySelector('[data-grid-sub-row]');
    expect(subRow).not.toBeNull();
    expect(subRow?.className).toContain('w-0');
    expect(subRow?.className).toContain('sticky');
    // The block is its direct content: the app adds no width wrapper of its own any more.
    expect(grid.container.querySelector('.w-0.min-w-full')).toBeNull();

    unmountAll();
    answerTableFlag('off');
    const cards = mount(loadingList);
    await settle();
    expect(cards.container.querySelector('[data-grid-sub-row]')).toBeNull();
    expect(cards.container.querySelector('.w-0.min-w-full')).toBeNull();
  });

  it('flag not answered: loading rows in the card layout, and the list is not read', async () => {
    answerTableFlag('loading');
    const mounted = mount(
      <NotificationsSection
        title="Notifications"
        queryRef={{} as never}
        searchValue=""
        onSearchChange={() => undefined}
        rowVariant="unread"
      />,
    );
    await settle();

    expect(seen.reads).toBe(0);
    expect(seen.table?.layout).toBe('cards');
    expect(hasGridMarkup(mounted.container)).toBe(false);
    expect(mounted.container.textContent).not.toContain('New release');
  });
});
