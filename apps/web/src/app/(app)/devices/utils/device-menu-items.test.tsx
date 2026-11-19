/**
 * The Remote Control slot: "Watch live" opening the live page while another technician's session runs on the
 * device, "Remote Control" otherwise, and a disabled Remote Control never turned into Watch live.
 */
import { describe, expect, it } from 'vitest';
import { routes } from '@/lib/routes';
import type { DeviceActionAvailability } from './device-action-utils';
import { buildDeviceMenuItems, WATCH_LIVE_ITEM_ID } from './device-menu-items';

const availability = (remoteControlEnabled: boolean) =>
  ({ remoteControlEnabled, remoteShellEnabled: true, manageFilesEnabled: true }) as DeviceActionAvailability;

const remoteControl = (enabled: boolean, watchLiveSessionId?: string | null) =>
  buildDeviceMenuItems({
    deviceId: 'machine-1',
    availability: availability(enabled),
    withNewTabAction: true,
    watchLiveSessionId,
  }).remoteControl;

describe('buildDeviceMenuItems remoteControl', () => {
  it('is Watch live, opening the live session page, while another technician holds a session', () => {
    const item = remoteControl(true, 'session-7');
    expect(item).toMatchObject({
      id: WATCH_LIVE_ITEM_ID,
      label: 'Watch live',
      href: routes.devices.liveSession('session-7'),
    });
    expect(item.disabled).toBeFalsy();
    expect(item.iconAction).toMatchObject({
      href: routes.devices.liveSession('session-7'),
      'aria-label': 'Open Watch live in new tab',
    });
  });

  it('is Remote Control when there is no session to watch', () => {
    for (const none of [undefined, null]) {
      expect(remoteControl(true, none)).toMatchObject({
        id: 'remote-control',
        label: 'Remote Control',
        href: routes.devices.remoteDesktop('machine-1'),
        disabled: false,
      });
    }
  });

  it('keeps a disabled Remote Control as it is, session or not', () => {
    expect(remoteControl(false, 'session-7')).toMatchObject({
      id: 'remote-control',
      label: 'Remote Control',
      href: routes.devices.remoteDesktop('machine-1'),
      disabled: true,
    });
  });
});
