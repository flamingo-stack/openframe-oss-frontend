import type ReactRelay from 'react-relay';
import { commitLocalUpdate, type Environment } from 'relay-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchQuery = vi.hoisted(() => vi.fn(() => ({ subscribe: vi.fn() })));

vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
  fetchQuery,
}));

import { NotificationEntityType } from '@/generated/schema-enums';
import { toGlobalId } from '@/lib/relay-id';
import { makeOfflineEnvironment } from './__tests__/store-fixtures';
import {
  clearEntityUnreadCounts,
  entityRefsOfAttributes,
  entityRefsOfEntity,
  entityRefsOfNotifications,
  refreshEntityUnreadCounts,
} from './entity-unread-counts';

const LOADED_MACHINE = toGlobalId('Machine', 'm-1');
const LOADED_INSIGHT = toGlobalId('Insight', 'i-1');

function seed(environment: Environment): void {
  commitLocalUpdate(environment, store => {
    store.create(LOADED_MACHINE, 'Machine').setValue(2, 'unreadNotificationCount');
    store.create(LOADED_INSIGHT, 'Insight').setValue(1, 'unreadNotificationCount');
    const notification = store.create('n-1', 'Notification');
    (notification as unknown as { setValue__UNSAFE: (v: unknown, n: string) => void }).setValue__UNSAFE(
      { deviceId: 'm-1', recordingId: 'r-1' },
      'attributes',
    );
  });
}

function countOf(environment: Environment, id: string): unknown {
  return environment.getStore().getSource().get(id)?.unreadNotificationCount;
}

describe('the entities a notification is about', () => {
  it('are read from its attributes, once each', () => {
    expect(
      entityRefsOfAttributes([{ deviceId: 'm-1' }, { deviceId: 'm-1', insightId: 'i-1' }, null, { insightId: '' }]),
    ).toEqual({ deviceIds: ['m-1'], insightIds: ['i-1'] });
  });

  it('are read from the store for a notification it holds', () => {
    const environment = makeOfflineEnvironment();
    seed(environment);
    expect(entityRefsOfNotifications(environment, ['n-1', 'n-missing'])).toEqual({
      deviceIds: ['m-1'],
      insightIds: [],
    });
  });

  it('are only devices and incidents: tickets and chats draw no row count', () => {
    expect(entityRefsOfEntity(NotificationEntityType.DEVICE, 'm-1')).toEqual({ deviceIds: ['m-1'], insightIds: [] });
    expect(entityRefsOfEntity(NotificationEntityType.TICKET, 't-1')).toEqual({ deviceIds: [], insightIds: [] });
  });
});

describe('re-reading a row count', () => {
  beforeEach(() => {
    fetchQuery.mockClear();
  });

  it('asks only for the devices and incidents a row has loaded', () => {
    const environment = makeOfflineEnvironment();
    seed(environment);
    refreshEntityUnreadCounts(environment, { deviceIds: ['m-1', 'm-not-loaded'], insightIds: ['i-1', 'i-not-loaded'] });

    expect(fetchQuery).toHaveBeenCalledTimes(2);
    expect(fetchQuery.mock.calls[0]).toEqual([
      environment,
      expect.anything(),
      { ids: [LOADED_MACHINE] },
      { fetchPolicy: 'network-only' },
    ]);
    expect(fetchQuery.mock.calls[1]).toEqual([
      environment,
      expect.anything(),
      { id: LOADED_INSIGHT },
      { fetchPolicy: 'network-only' },
    ]);
  });

  it('asks nothing when no row holds them', () => {
    refreshEntityUnreadCounts(makeOfflineEnvironment(), { deviceIds: ['m-1'], insightIds: ['i-1'] });
    expect(fetchQuery).not.toHaveBeenCalled();
  });
});

describe('Mark all as read', () => {
  it('takes every loaded row count to 0', () => {
    const environment = makeOfflineEnvironment();
    seed(environment);
    clearEntityUnreadCounts(environment);
    expect(countOf(environment, LOADED_MACHINE)).toBe(0);
    expect(countOf(environment, LOADED_INSIGHT)).toBe(0);
  });
});
