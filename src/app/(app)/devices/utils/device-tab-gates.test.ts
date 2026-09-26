// A deep link to Agent Logs must neither paint Overview while the flag loads nor
// open a tab the tenant does not have; the page and its skeleton must agree on
// the tab bar, or the active tab jumps once the flag lands.
import { describe, expect, it } from 'vitest';
import { AGENT_LOGS_TAB_ID, listsAgentLogsTab, resolveDeviceTab } from './device-tab-gates';

const BASE = ['overview', 'hardware', 'software'];

describe('listsAgentLogsTab', () => {
  it('lists the tab when the flag is on, for any request', () => {
    expect(listsAgentLogsTab('on', 'overview')).toBe(true);
  });

  it('holds its place while the flag loads only for the deep link that asked for it', () => {
    expect(listsAgentLogsTab('loading', AGENT_LOGS_TAB_ID)).toBe(true);
    expect(listsAgentLogsTab('loading', 'overview')).toBe(false);
  });

  it('never lists it once the flag is off, even for a deep link', () => {
    expect(listsAgentLogsTab('off', AGENT_LOGS_TAB_ID)).toBe(false);
  });
});

describe('resolveDeviceTab', () => {
  it('waits on a deep link while the flag loads, on the requested tab', () => {
    const listed = [...BASE, AGENT_LOGS_TAB_ID];
    expect(resolveDeviceTab(AGENT_LOGS_TAB_ID, listed, 'loading')).toEqual({
      tab: AGENT_LOGS_TAB_ID,
      awaitingFlag: true,
    });
  });

  it('opens the tab when the flag is on, and falls back to Overview when it is off', () => {
    expect(resolveDeviceTab(AGENT_LOGS_TAB_ID, [...BASE, AGENT_LOGS_TAB_ID], 'on')).toEqual({
      tab: AGENT_LOGS_TAB_ID,
      awaitingFlag: false,
    });
    expect(resolveDeviceTab(AGENT_LOGS_TAB_ID, BASE, 'off')).toEqual({ tab: 'overview', awaitingFlag: false });
  });

  it('sends an unknown or unlisted tab to Overview instead of a blank panel', () => {
    expect(resolveDeviceTab('queries', BASE, 'on').tab).toBe('overview');
    expect(resolveDeviceTab('nonsense', BASE, 'loading')).toEqual({ tab: 'overview', awaitingFlag: false });
  });
});
