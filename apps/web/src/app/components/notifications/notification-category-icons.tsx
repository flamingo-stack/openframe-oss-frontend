import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import {
  AlertTriangleIcon,
  BracketCurlyIcon,
  ChartDonutIcon,
  ClipboardListIcon,
  CloudIcon,
  IdCardIcon,
  MonitorIcon,
  PackageIcon,
  RadarIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';
import { NEW_PERMISSIONS_REQUIRED_TYPE } from '@/graphql/notifications/notification-attributes';

/** Backend `type` → icon, for the types whose category (GENERIC) carries none. */
const iconByType: Record<string, ReactNode> = {
  [NEW_PERMISSIONS_REQUIRED_TYPE]: <CloudIcon size={16} />,
};

/**
 * Backend `NotificationCategory` → icon, mirroring the app navigation mapping
 * (`src/lib/navigation-config.tsx`). GENERIC and unknown categories resolve to
 * undefined. Icons inherit the host's text color via `currentColor`, except the
 * Mingo mark which keeps its canonical brand colors (white + cyan).
 */
const iconByCategory: Record<string, ReactNode> = {
  DASHBOARD: <ChartDonutIcon size={16} />,
  CUSTOMERS: <IdCardIcon size={16} />,
  DEVICES: <MonitorIcon size={16} />,
  SCRIPTS: <BracketCurlyIcon size={16} />,
  MONITORING: <RadarIcon size={16} />,
  SOFTWARE: <PackageIcon size={16} />,
  LOGS: <ClipboardListIcon size={16} />,
  TICKETS: <TagIcon size={16} />,
  INSIGHTS: <AlertTriangleIcon size={16} />,
  MINGO: (
    <MingoIcon
      className="size-4"
      eyesColor="var(--ods-flamingo-cyan-base)"
      cornerColor="var(--ods-flamingo-cyan-base)"
    />
  ),
};

/** The tile icon: the type's own when it has one, else the category's, else none (the severity dot). */
export function getNotificationIcon(notification: Notification): ReactNode | undefined {
  const type = notification.meta?.notificationType;
  const byType = typeof type === 'string' ? iconByType[type] : undefined;
  const category = notification.category;
  return byType ?? (category ? iconByCategory[category.toUpperCase()] : undefined);
}

/** Attach the icon for tile rendering; explicit `icon`/`imageUrl` win. */
export function withNotificationIcon(notification: Notification): Notification {
  if (notification.icon || notification.imageUrl) return notification;
  const icon = getNotificationIcon(notification);
  return icon ? { ...notification, icon } : notification;
}
