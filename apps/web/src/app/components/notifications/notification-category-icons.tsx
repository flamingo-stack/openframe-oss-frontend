import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { AgentMark, NamedIcon, type IconRef } from '@flamingo-stack/openframe-frontend-core/components';
import type { ReactNode } from 'react';
import { NEW_PERMISSIONS_REQUIRED_TYPE } from '@/graphql/notifications/notification-attributes';

/** Backend `type` → icon, for the types whose category (GENERIC) carries none. */
const ICON_BY_TYPE: Readonly<Record<string, IconRef>> = {
  [NEW_PERMISSIONS_REQUIRED_TYPE]: { set: 'CloudIcon' },
};

/**
 * Backend `NotificationCategory` → icon, mirroring the app navigation mapping
 * (`src/lib/navigation-config.tsx`). A table of icon NAMES: the icon of a
 * category is loaded when a notification of that category is drawn. GENERIC and
 * unknown categories resolve to undefined. Every icon, the assistant's mark
 * included, takes the host's text colour, so a row of them is one colour.
 */
const ICON_BY_CATEGORY: Readonly<Record<string, IconRef>> = {
  DASHBOARD: { set: 'ChartDonutIcon' },
  CUSTOMERS: { set: 'IdCardIcon' },
  DEVICES: { set: 'MonitorIcon' },
  SCRIPTS: { set: 'BracketCurlyIcon' },
  MONITORING: { set: 'RadarIcon' },
  SOFTWARE: { set: 'PackageIcon' },
  LOGS: { set: 'ClipboardListIcon' },
  TICKETS: { set: 'TagIcon' },
  INSIGHTS: { set: 'AlertTriangleIcon' },
  INTEGRATIONS: { set: 'CodingForkIcon' },
};

/** The category whose notifications carry the assistant's own mark, drawn from its identity. */
const ASSISTANT_CATEGORY = 'MINGO';

/** A table's own entry only: a backend string never resolves to `Object.prototype` (`constructor`, `toString`). */
function ownIcon(table: Readonly<Record<string, IconRef>>, key: string): IconRef | undefined {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

function getNotificationCategoryIcon(category: string | null | undefined): ReactNode | undefined {
  const key = category?.toUpperCase();
  if (!key) return undefined;
  if (key === ASSISTANT_CATEGORY) return <AgentMark agent="mingo" className="size-4" color="currentColor" />;
  const icon = ownIcon(ICON_BY_CATEGORY, key);
  return icon ? <NamedIcon icon={icon} size={16} /> : undefined;
}

/** The tile icon: the type's own when it has one, else the category's, else none (the severity dot). */
export function getNotificationIcon(notification: Notification): ReactNode | undefined {
  const type = notification.meta?.notificationType;
  const byType = typeof type === 'string' ? ownIcon(ICON_BY_TYPE, type) : undefined;
  return byType ? <NamedIcon icon={byType} size={16} /> : getNotificationCategoryIcon(notification.category);
}

/** Attach the icon for tile rendering; explicit `icon`/`imageUrl` win. */
export function withNotificationIcon(notification: Notification): Notification {
  if (notification.icon || notification.imageUrl) return notification;
  const icon = getNotificationIcon(notification);
  return icon ? { ...notification, icon } : notification;
}
