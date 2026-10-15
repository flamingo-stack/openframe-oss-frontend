// Pins which online device each "What to ask Mingo?" prompt names: a
// workstation for "slow", a server for its logs, a Windows device for the print
// spooler, a different one each while there are enough, the name the device
// list shows, and a prompt without a name when nothing fits.

import { describe, expect, it } from 'vitest';
import { buildMingoWhatToAsk, type WhatToAskDevice } from './what-to-ask';

const labels = (devices: WhatToAskDevice[]) =>
  buildMingoWhatToAsk(devices).groups.flatMap(group => group.prompts.map(prompt => prompt.label));

const find = (devices: WhatToAskDevice[], start: string) => labels(devices).find(label => label.startsWith(start));

const device = (fields: Pick<WhatToAskDevice, 'id' | 'hostname' | 'type' | 'osType'>): WhatToAskDevice => ({
  displayName: null,
  nickname: null,
  ...fields,
});
const LAPTOP = device({ id: '1', hostname: 'ann-mbp', type: 'LAPTOP', osType: 'MAC_OS' });
const SERVER = device({ id: '2', hostname: 'lab-srv-02', type: 'SERVER', osType: 'MAC_OS' });
const WINDOWS_DESKTOP = device({ id: '3', hostname: 'acme-ws-07', type: 'DESKTOP', osType: 'WINDOWS' });

describe('buildMingoWhatToAsk', () => {
  it('names a fitting online device in each of the three prompts', () => {
    const devices = [LAPTOP, SERVER, WINDOWS_DESKTOP];

    expect(find(devices, 'Why is')).toBe('Why is ann-mbp slow? Check CPU, memory and disk');
    expect(find(devices, 'Pull error logs')).toBe(
      'Pull error logs from lab-srv-02 for the last hour and tell me what failed',
    );
    expect(find(devices, 'Clear the print spooler')).toBe('Clear the print spooler on acme-ws-07');
  });

  it('keeps the Windows device for the spooler and spreads the rest over other devices', () => {
    const devices = [WINDOWS_DESKTOP, { ...LAPTOP, id: '4', hostname: 'bob-mbp' }];

    expect(find(devices, 'Clear the print spooler')).toBe('Clear the print spooler on acme-ws-07');
    expect(find(devices, 'Pull error logs')).toContain('bob-mbp');
    // Two devices for three prompts: one is named twice rather than left out.
    expect(find(devices, 'Why is')).toMatch(/^Why is (acme-ws-07|bob-mbp) slow\?/);
  });

  it('uses the name the device list shows', () => {
    const devices = [{ ...LAPTOP, nickname: "Ann's laptop", displayName: 'Ann MacBook' }];

    expect(find(devices, 'Why is')).toBe("Why is Ann's laptop slow? Check CPU, memory and disk");
  });

  it('asks without a name when no device fits', () => {
    expect(find([], 'Which devices are slow')).toBe('Which devices are slow right now? Check CPU, memory and disk');
    expect(find([], 'Pull error logs')).toBe(
      'Pull error logs from my servers for the last hour and tell me what failed',
    );
    expect(find([LAPTOP], 'Clear the print spooler')).toBe('Clear the print spooler on a Windows device');
  });

  it('keeps every group full', () => {
    const groups = buildMingoWhatToAsk([]).groups;
    expect(groups.map(group => [group.label, group.prompts.length])).toEqual([
      ['Diagnose', 3],
      ['Check', 4],
      ['Fix', 4],
    ]);
  });
});
