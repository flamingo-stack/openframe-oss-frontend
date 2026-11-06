/**
 * The action cell of the notifications table for an announcement's link. Nothing reads an
 * announcement by arriving somewhere, so the cell's own click is what reads the row.
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

function renderActionCell(original: NotificationRow) {
  const column = buildNotificationColumns({ rowVariant: 'unread', onMarkRead }).find(c => c.id === 'action');
  const cell = column?.cell as (context: { row: { original: NotificationRow } }) => ReactNode;
  act(() => root.render(<>{cell({ row: { original } })}</>));
  return [...container.querySelectorAll('a')];
}

beforeEach(() => {
  onMarkRead = vi.fn<(id: string) => void>();
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
