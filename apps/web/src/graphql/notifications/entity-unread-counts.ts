import { fetchQuery, graphql } from 'react-relay';
import { commitLocalUpdate, type IEnvironment } from 'relay-runtime';
import type { entityUnreadCountsInsightQuery as EntityUnreadCountsInsightQueryType } from '@/__generated__/entityUnreadCountsInsightQuery.graphql';
import type { entityUnreadCountsMachinesQuery as EntityUnreadCountsMachinesQueryType } from '@/__generated__/entityUnreadCountsMachinesQuery.graphql';
import { NotificationEntityType } from '@/generated/schema-enums';
import { ensureGlobalIdForType, toGlobalId } from '@/lib/relay-id';
import { NOTIFICATION_ATTR, readNotificationAttributes } from './notification-attributes';

/*
 * The count a device or incident row draws (`Machine.unreadNotificationCount`, `Insight.unreadNotificationCount`)
 * moves with the sidebar's per-category counts, and every path that refreshes those knows which notifications moved:
 * a live push carries its attributes, a read or a delete names a notification already in the store. These re-read
 * the count of the entities those notifications are about, and only of the ones a row has loaded: a device or an
 * incident nobody is looking at is read with its list, next time it is drawn.
 */

export const entityUnreadCountsMachinesQuery = graphql`
  query entityUnreadCountsMachinesQuery($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Machine {
        id
        unreadNotificationCount
      }
    }
  }
`;

export const entityUnreadCountsInsightQuery = graphql`
  query entityUnreadCountsInsightQuery($id: ID!) {
    insight(id: $id) {
      id
      unreadNotificationCount
    }
  }
`;

/** The entities some notifications are about, by their raw stored ids (`attributes.deviceId` / `insightId`). */
export interface NotificationEntityRefs {
  deviceIds: string[];
  insightIds: string[];
}

const UNREAD_COUNT_FIELD = 'unreadNotificationCount';

/** The entities named by these attribute maps (a push's, or a stored notification's). */
export function entityRefsOfAttributes(attributeMaps: readonly unknown[]): NotificationEntityRefs {
  const deviceIds = new Set<string>();
  const insightIds = new Set<string>();
  for (const value of attributeMaps) {
    const attributes = readNotificationAttributes(value);
    const deviceId = attributes[NOTIFICATION_ATTR.deviceId];
    const insightId = attributes[NOTIFICATION_ATTR.insightId];
    if (deviceId) deviceIds.add(deviceId);
    if (insightId) insightIds.add(insightId);
  }
  return { deviceIds: [...deviceIds], insightIds: [...insightIds] };
}

/** The entities the notifications with these Relay ids are about, as far as the store knows them. */
export function entityRefsOfNotifications(environment: IEnvironment, ids: readonly string[]): NotificationEntityRefs {
  const source = environment.getStore().getSource();
  return entityRefsOfAttributes(ids.map(id => source.get(id)?.attributes));
}

/** One entity, as `markNotificationsReadForEntity` names it. Tickets and dialogs draw no such count. */
export function entityRefsOfEntity(type: NotificationEntityType, id: string): NotificationEntityRefs {
  return {
    deviceIds: type === NotificationEntityType.DEVICE ? [id] : [],
    insightIds: type === NotificationEntityType.INSIGHT ? [id] : [],
  };
}

/** Re-read the unread counts of the loaded devices and incidents among `refs`. Best effort: a failure keeps the count. */
export function refreshEntityUnreadCounts(environment: IEnvironment, refs: NotificationEntityRefs): void {
  const source = environment.getStore().getSource();
  const machineIds = refs.deviceIds.map(id => toGlobalId('Machine', id)).filter(id => source.get(id) != null);
  if (machineIds.length > 0) {
    fetchQuery<EntityUnreadCountsMachinesQueryType>(
      environment,
      entityUnreadCountsMachinesQuery,
      { ids: machineIds },
      { fetchPolicy: 'network-only' },
    ).subscribe({ error: () => {} });
  }
  for (const insightId of refs.insightIds) {
    const id = ensureGlobalIdForType('Insight', insightId);
    if (source.get(id) == null) continue;
    fetchQuery<EntityUnreadCountsInsightQueryType>(
      environment,
      entityUnreadCountsInsightQuery,
      { id },
      { fetchPolicy: 'network-only' },
    ).subscribe({ error: () => {} });
  }
}

/** Every loaded device and incident to 0: the viewer just read everything. */
export function clearEntityUnreadCounts(environment: IEnvironment): void {
  const source = environment.getStore().getSource();
  const ids = source.getRecordIDs().filter(id => {
    const count = source.get(id)?.[UNREAD_COUNT_FIELD];
    return typeof count === 'number' && count > 0;
  });
  if (ids.length === 0) return;
  commitLocalUpdate(environment, store => {
    for (const id of ids) store.get(id)?.setValue(0, UNREAD_COUNT_FIELD);
  });
}
