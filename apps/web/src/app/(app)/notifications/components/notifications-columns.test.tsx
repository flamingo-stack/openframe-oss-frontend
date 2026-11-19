/**
 * The action cell of the notifications table for an announcement's link. Nothing reads an
 * announcement by arriving somewhere, so the cell's own click is what reads the row.
 *
 * And the columns' grid form: one line per cell, the open action as a bare icon button in its own action column, and
 * the card layout's columns left as they were.
 */

import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => ({ host: 'https://acme.openframe.ai' }));
vi.mock('@/lib/runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => tenant.host } }));
vi.mock('@/app/components/notifications/open-mingo-dialog', () => ({
  canOpenMingoDialogOverPage: () => false,
  openMingoDialog: vi.fn(),
}));

import { resolveNotificationAction } from '@/app/components/notifications/notification-navigation';
import { stubLayoutApis } from '@/app/hooks/use-table-layout.fixtures';
import { buildNotificationColumns, type NotificationRow } from './notifications-columns';

const OUTSIDE = 'https://www.flamingo.run/releases/v1-5-81';

function row(link: string, state: Partial<Pick<NotificationRow, 'read' | 'archived'>> = {}): NotificationRow {
  const notification = {
    id: 'n-1',
    title: 'New release',
    createdAt: 0,
    read: state.read ?? false,
    category: 'GENERIC',
    meta: { notificationType: 'ANNOUNCEMENT', link },
  } as Notification;
  return {
    id: 'n-1',
    title: 'New release',
    description: null,
    createdAt: 0,
    read: false,
    archived: false,
    ...state,
    notification,
  };
}

let root: Root;
let container: HTMLElement;
let onMarkRead: ReturnType<typeof vi.fn<(id: string) => void>>;
let onDelete: ReturnType<typeof vi.fn<(id: string) => void>>;

type CellRenderer = (context: { row: { original: NotificationRow } }) => ReactNode;

/** One column's grid cell, drawn for a row. */
function renderGridCell(columnId: string, original: NotificationRow, rowVariant: 'unread' | 'read' = 'unread') {
  const column = buildNotificationColumns({ rowVariant, onMarkRead, onDelete, layout: 'grid' }).find(
    c => c.id === columnId,
  );
  const cell = (column?.meta as { gridCell?: CellRenderer } | undefined)?.gridCell;
  act(() => root.render(<>{cell?.({ row: { original } })}</>));
  return container;
}

function renderActionCell(original: NotificationRow) {
  const column = buildNotificationColumns({ rowVariant: 'unread', onMarkRead }).find(c => c.id === 'action');
  const cell = column?.cell as (context: { row: { original: NotificationRow } }) => ReactNode;
  act(() => root.render(<>{cell({ row: { original } })}</>));
  return [...container.querySelectorAll('a')];
}

beforeEach(() => {
  stubLayoutApis();
  onMarkRead = vi.fn<(id: string) => void>();
  onDelete = vi.fn<(id: string) => void>();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // jsdom does not navigate; a followed anchor would only log that.
  container.addEventListener('click', event => event.preventDefault());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('an announcement that links outside the app', () => {
  it('opens the link in a new tab from every width, and reads the row', () => {
    const anchors = renderActionCell(row(OUTSIDE));

    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.getAttribute('href')).toBe(OUTSIDE);
      expect(anchor.getAttribute('target')).toBe('_blank');
    }
    act(() => anchors[0].click());
    expect(onMarkRead).toHaveBeenCalledWith('n-1');
  });

  it('reads nothing when the row is already read', () => {
    const anchors = renderActionCell(row(OUTSIDE, { read: true }));

    act(() => anchors[0].click());
    expect(onMarkRead).not.toHaveBeenCalled();
  });
});

describe('an announcement that links a page in the app', () => {
  it('opens the page here, and reads the row on open', () => {
    const anchors = renderActionCell(row('https://acme.openframe.ai/devices'));

    expect(anchors.map(anchor => anchor.getAttribute('href'))).toContain('/devices');
    const here = anchors.find(anchor => anchor.getAttribute('target') !== '_blank');
    expect(here).toBeDefined();
    act(() => here?.click());
    expect(onMarkRead).toHaveBeenCalledWith('n-1');
  });
});

describe('the grid form of the columns', () => {
  const APP_LINK = 'https://acme.openframe.ai/devices';

  it('keeps the card columns as they were, and names the details column only in the grid', () => {
    const cards = buildNotificationColumns({ rowVariant: 'unread' });
    expect(cards.map(({ id, header, meta }) => [id, header, meta?.width, meta?.hideAt, meta?.align])).toEqual([
      ['notification', 'Notification', 'flex-[2] min-w-0', undefined, undefined],
      ['details', '', 'flex-[3] min-w-0', 'md', undefined],
      ['action', '', 'w-11 shrink-0 content-md:w-[210px]', undefined, 'right'],
      ['rowIcon', '', 'w-11 shrink-0 content-md:w-12', undefined, 'right'],
    ]);

    const grid = buildNotificationColumns({ rowVariant: 'unread', layout: 'grid' });
    expect(grid.map(({ id, header }) => [id, header])).toEqual([
      ['notification', 'Notification'],
      ['details', 'Details'],
      ['action', ''],
      ['rowIcon', ''],
    ]);
  });

  it('makes the two buttons action columns: 56px, never sorted, never hidden', () => {
    const actions = buildNotificationColumns({ rowVariant: 'unread', layout: 'grid' }).filter(
      column => column.meta?.gridKind === 'action',
    );
    expect(actions.map(({ id, size, enableSorting, enableHiding }) => [id, size, enableSorting, enableHiding])).toEqual(
      [
        ['action', 56, false, false],
        ['rowIcon', 56, false, false],
      ],
    );
  });

  it('opens a page of the app from one bare icon button, named by the action, and reads the row', () => {
    const original = row(APP_LINK);
    const label = resolveNotificationAction(original.notification)?.label;
    const anchors = [...renderGridCell('action', original).querySelectorAll('a')];

    expect(label).toBeTruthy();
    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute('href')).toBe('/devices');
    expect(anchors[0].getAttribute('target')).not.toBe('_blank');
    expect(anchors[0].getAttribute('aria-label')).toBe(label);
    expect(anchors[0].className).toContain('border-0');
    // The label is the button's name and its tooltip: the 56px column prints no text.
    expect(container.textContent).toBe('');
    act(() => anchors[0].click());
    expect(onMarkRead).toHaveBeenCalledWith('n-1');
  });

  it('opens a link outside the app in a new tab from one bare icon button', () => {
    const anchors = [...renderGridCell('action', row(OUTSIDE)).querySelectorAll('a')];

    expect(anchors).toHaveLength(1);
    expect(anchors[0].getAttribute('href')).toBe(OUTSIDE);
    expect(anchors[0].getAttribute('target')).toBe('_blank');
    expect(anchors[0].getAttribute('aria-label')).toMatch(/ in new tab$/);
    expect(anchors[0].className).toContain('border-0');
    expect(container.textContent).toBe('');
  });

  it('marks an unread row as done and deletes a read one from a bare icon button', () => {
    const done = renderGridCell('rowIcon', row(APP_LINK)).querySelector('button');
    expect(done?.getAttribute('aria-label')).toBe('Mark as done');
    expect(done?.className).toContain('border-0');
    act(() => done?.click());
    expect(onMarkRead).toHaveBeenCalledWith('n-1');

    const remove = renderGridCell('rowIcon', row(APP_LINK, { read: true }), 'read').querySelector('button');
    expect(remove?.getAttribute('aria-label')).toBe('Delete notification');
    expect(remove?.className).toContain('border-0');
    act(() => remove?.click());
    expect(onDelete).toHaveBeenCalledWith('n-1');
  });

  it('prints the title, the Archived tag and the time on one line', () => {
    const cell = renderGridCell('notification', { ...row(APP_LINK, { archived: true }), createdAt: Date.now() });

    expect(cell.textContent).toContain('New release');
    expect(cell.textContent).toContain('Archived');
    expect(cell.querySelector('[data-part="time"]')?.textContent).toBeTruthy();
    expect(cell.innerHTML).not.toContain('flex-col');
  });

  it('prints the kind and the description on one line', () => {
    const original = { ...row(APP_LINK), description: 'Version 1.5.81 is out.\nSee what changed.' };
    original.notification = { ...original.notification, type: 'Announcement' } as Notification;
    const cell = renderGridCell('details', original);

    expect(cell.textContent).toContain('Announcement');
    expect(cell.textContent).toContain('Version 1.5.81 is out.');
    expect(cell.innerHTML).not.toContain('flex-col');
    expect(cell.innerHTML).not.toContain('line-clamp');
  });
});
