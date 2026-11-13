/**
 * Pins which version the outdated-client check reads (the agent registry before the machine's
 * own field, which goes stale after a self-update) and where the line is (below 1.6.0).
 */

import { describe, expect, it } from 'vitest';
import type { InstalledAgent } from '../types/device.types';
import { isClientOutdated, openframeClientVersion } from './client-version';

function agent(agentType: string, version: string): InstalledAgent {
  return { id: `${agentType}-1`, machineId: 'm-1', agentType, version, createdAt: '', updatedAt: '' };
}

describe('openframeClientVersion', () => {
  it("reads the registry's openframe-client entry before the machine's agentVersion", () => {
    const installedAgents = [agent('fleetmdm-agent', '1.40.0'), agent('openframe-client', '1.6.10')];
    expect(openframeClientVersion({ installedAgents, agentVersion: '1.5.2' })).toBe('1.6.10');
  });

  it('falls back to agentVersion when the registry has no client entry', () => {
    expect(
      openframeClientVersion({ installedAgents: [agent('fleetmdm-agent', '1.40.0')], agentVersion: '1.5.2' }),
    ).toBe('1.5.2');
    expect(openframeClientVersion({ agentVersion: '1.5.2' })).toBe('1.5.2');
  });
});

describe('isClientOutdated', () => {
  it.each([
    ['1.5.99', true],
    ['0.9.0', true],
    ['1.6.0', false],
    ['1.6.10', false],
    ['2.0.0', false],
  ])('%s → %s', (version, outdated) => {
    expect(isClientOutdated({ installedAgents: [agent('openframe-client', version)] })).toBe(outdated);
  });

  it('is not outdated when the self-updated registry entry is current, whatever agentVersion says', () => {
    expect(isClientOutdated({ installedAgents: [agent('openframe-client', '1.6.10')], agentVersion: '1.5.0' })).toBe(
      false,
    );
  });

  it('never flags a version it cannot read', () => {
    for (const agentVersion of [undefined, '', 'unknown', 'abc1234']) {
      expect(isClientOutdated({ agentVersion })).toBe(false);
    }
  });
});
