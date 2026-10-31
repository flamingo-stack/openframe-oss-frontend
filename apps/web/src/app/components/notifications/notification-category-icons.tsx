import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { NamedIcon, type IconRef } from '@flamingo-stack/openframe-frontend-core/components';
import { notificationCategoryIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { ReactNode } from 'react';
import { NEW_PERMISSIONS_REQUIRED_TYPE } from '@/graphql/notifications/notification-attributes';

/** Backend `type` → icon, for the types whose category (GENERIC) carries none. */
const ICON_BY_TYPE: Readonly<Record<string, IconRef>> = {
  [NEW_PERMISSIONS_REQUIRED_TYPE]: { set: 'CloudIcon' },
};

/** A table's own entry only: a backend string never resolves to `Object.prototype` (`constructor`, `toString`). */
function ownIcon(table: Readonly<Record<string, IconRef>>, key: string): IconRef | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

/**
 * The tile icon: the type's own when it has one, else its category's (the lib's `notificationCategoryIcon`, the one
 * category-to-icon table every host draws from), else none (the severity dot).
 */
export function getNotificationIcon(notification: Notification): ReactNode | undefined {
  const type = notification.meta?.notificationType;
  const byType = typeof type === 'string' ? ownIcon(ICON_BY_TYPE, type) : undefined;
  return byType ? <NamedIcon icon={byType} size={16} /> : notificationCategoryIcon(notification.category);
}

/** Attach the icon for tile rendering; explicit `icon`/`imageUrl` win. */
export function withNotificationIcon(notification: Notification): Notification {
  if (notification.icon || notification.imageUrl) return notification;
  const icon = getNotificationIcon(notification);
  return icon ? { ...notification, icon } : notification;
}
