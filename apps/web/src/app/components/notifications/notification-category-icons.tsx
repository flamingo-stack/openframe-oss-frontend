import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { AgentMark, NamedIcon, type IconRef } from '@flamingo-stack/openframe-frontend-core/components';
import type { ReactNode } from 'react';

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
};

/** The category whose notifications carry the assistant's own mark, drawn from its identity. */
const ASSISTANT_CATEGORY = 'MINGO';

export function getNotificationCategoryIcon(category: string | null | undefined): ReactNode | undefined {
  const key = category?.toUpperCase();
  if (!key) return undefined;
  if (key === ASSISTANT_CATEGORY) return <AgentMark agent="mingo" className="size-4" color="currentColor" />;
  const icon = Object.prototype.hasOwnProperty.call(ICON_BY_CATEGORY, key) ? ICON_BY_CATEGORY[key] : undefined;
  return icon ? <NamedIcon icon={icon} size={16} /> : undefined;
}

/** Attach the category icon for tile rendering; explicit `icon`/`imageUrl` win. */
export function withCategoryIcon(notification: Notification): Notification {
  if (notification.icon || notification.imageUrl) return notification;
  const icon = getNotificationCategoryIcon(notification.category);
  return icon ? { ...notification, icon } : notification;
}
