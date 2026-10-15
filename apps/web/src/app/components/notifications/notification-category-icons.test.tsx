import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it } from 'vitest';
import { getNotificationIcon } from './notification-category-icons';

const generic: Notification = { id: 'n-1', title: 'x', createdAt: 0, category: 'GENERIC' };

describe('getNotificationIcon', () => {
  it('draws the type icon where the category carries none', () => {
    expect(getNotificationIcon(generic)).toBeUndefined();
    expect(getNotificationIcon({ ...generic, meta: { notificationType: 'NEW_PERMISSIONS_REQUIRED' } })).toBeDefined();
  });

  it('falls back to the category icon for a type without one of its own', () => {
    const device = { ...generic, category: 'DEVICES', meta: { notificationType: 'DEVICE_OFFLINE' } };
    expect(getNotificationIcon(device)).toBeDefined();
  });
});
