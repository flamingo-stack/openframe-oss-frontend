// "Device Logs" existed before Agent Logs and pointed at Overview's logs table;
// the flag must redirect it, never remove it, or every tenant without the flag
// loses the entry.
import { describe, expect, it } from 'vitest';
import { buildDeviceMenuItems } from './device-menu-items';

const logsHref = (agentLogsEnabled: boolean) =>
  buildDeviceMenuItems({ deviceId: 'machine-1', availability: null, agentLogsEnabled }).deviceLogs.href;

describe('buildDeviceMenuItems → deviceLogs', () => {
  it('opens the Agent Logs tab when the flag is on', () => {
    expect(logsHref(true)).toContain('tab=agent-logs');
  });

  it('keeps the entry and points at Overview when the flag is off or unknown', () => {
    expect(logsHref(false)).toContain('tab=overview');
    expect(buildDeviceMenuItems({ deviceId: 'machine-1', availability: null }).deviceLogs.href).toContain(
      'tab=overview',
    );
  });

  it('targets the device it was built for', () => {
    expect(logsHref(true)).toContain('id=machine-1');
  });
});
