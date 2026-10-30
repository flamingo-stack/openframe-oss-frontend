// Pins which online device each "What to ask Mingo?" prompt names: a
// workstation for "slow", a server for its logs, a Windows device for the print
// spooler, any for the DNS cache, a different one each while there are enough;
// that the chip shows the name the device list shows while the message carries
// the device's `@device:<id>` mention (hostnames repeat across a fleet); and a
// prompt without a name when nothing fits. Also that every prompt is one Mingo's
// tools can answer (no "offline since when", no "update software"), and that every chip
// is drawn as Mingo's quick actions are: its icon in Mingo's accent.

import { getAgentAccent, type SuggestionPrompt } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { describe, expect, it } from 'vitest';
import { toGlobalId } from '@/lib/relay-id';
import { buildMingoWhatToAsk, type WhatToAskDevice } from './what-to-ask';

const prompts = (devices: WhatToAskDevice[]): SuggestionPrompt[] =>
  buildMingoWhatToAsk(devices).groups.flatMap(group => group.prompts);

const find = (devices: WhatToAskDevice[], start: string) =>
  prompts(devices).find(prompt => prompt.label.startsWith(start));

const device = (
  rawId: string,
  fields: Pick<WhatToAskDevice, 'hostname' | 'type' | 'osType'> & Partial<WhatToAskDevice>,
): WhatToAskDevice => ({
  id: toGlobalId('Machine', rawId),
  machineId: `machine-${rawId}`,
  displayName: null,
  nickname: null,
  ...fields,
});
const LAPTOP = device('1', { hostname: 'ann-mbp', type: 'LAPTOP', osType: 'MAC_OS' });
const SERVER = device('2', { hostname: 'lab-srv-02', type: 'SERVER', osType: 'MAC_OS' });
const WINDOWS_DESKTOP = device('3', { hostname: 'acme-ws-07', type: 'DESKTOP', osType: 'WINDOWS' });
const SPARE = device('4', { hostname: 'spare-01', type: 'OTHER', osType: 'MAC_OS' });

describe('buildMingoWhatToAsk', () => {
  it('shows a fitting online device on each chip and sends its mention', () => {
    const devices = [LAPTOP, SERVER, WINDOWS_DESKTOP, SPARE];

    expect(find(devices, 'Why is')).toMatchObject({
      label: 'Why is ann-mbp slow? Check CPU, memory and disk',
      prompt: 'Why is @device:1 slow? Check CPU, memory and disk',
    });
    expect(find(devices, 'Pull error logs')).toMatchObject({
      label: 'Pull error logs from lab-srv-02 for the last hour and tell me what failed',
      prompt: 'Pull error logs from @device:2 for the last hour and tell me what failed',
    });
    expect(find(devices, 'Clear the print spooler')).toMatchObject({
      label: 'Clear the print spooler on acme-ws-07',
      prompt: 'Clear the print spooler on @device:3',
    });
    expect(find(devices, 'Flush the DNS cache')).toMatchObject({
      label: 'Flush the DNS cache on spare-01',
      prompt: 'Flush the DNS cache on @device:4',
    });
  });

  it('keeps the Windows device for the spooler and spreads the rest over other devices', () => {
    const devices = [WINDOWS_DESKTOP, device('5', { hostname: 'bob-mbp', type: 'LAPTOP', osType: 'MAC_OS' })];

    expect(find(devices, 'Clear the print spooler')?.label).toBe('Clear the print spooler on acme-ws-07');
    expect(find(devices, 'Pull error logs')?.label).toContain('bob-mbp');
    // Two devices for four prompts: some are named twice rather than left out.
    expect(find(devices, 'Why is')?.label).toMatch(/^Why is (acme-ws-07|bob-mbp) slow\?/);
  });

  it('shows the name the device list shows, and sends the mention whatever the name', () => {
    const named = device('6', { hostname: 'ann-mbp', type: 'LAPTOP', osType: 'MAC_OS', nickname: "Ann's laptop" });

    expect(find([named], 'Why is')).toMatchObject({
      label: "Why is Ann's laptop slow? Check CPU, memory and disk",
      prompt: 'Why is @device:6 slow? Check CPU, memory and disk',
    });
  });

  it('asks without a name, and sends the text as shown, when no device fits', () => {
    expect(find([], 'Which devices are slow')).toEqual({
      label: 'Which devices are slow right now? Check CPU, memory and disk',
      icon: { name: 'laptop', accent: getAgentAccent('mingo') },
    });
    expect(find([], 'Pull error logs')?.label).toBe(
      'Pull error logs from my servers for the last hour and tell me what failed',
    );
    expect(find([LAPTOP], 'Clear the print spooler')).toEqual({
      label: 'Clear the print spooler on a Windows device',
      icon: { name: 'wrench', accent: getAgentAccent('mingo') },
    });
    expect(find([], 'Flush the DNS cache')?.label).toBe('Flush the DNS cache on a device that cannot load websites');
  });

  it('only offers what Mingo can answer', () => {
    const labels = prompts([LAPTOP]).map(prompt => prompt.label);

    expect(labels).toContain('Which devices are offline right now?');
    expect(labels.some(label => /offline today|when did each drop/i.test(label))).toBe(false);
    expect(labels.some(label => /^Update /.test(label))).toBe(false);
  });

  it('keeps every group full', () => {
    const groups = buildMingoWhatToAsk([]).groups;
    expect(groups.map(group => [group.label, group.prompts.length])).toEqual([
      ['Diagnose', 3],
      ['Check', 4],
      ['Fix', 4],
    ]);
  });

  it("draws every chip as Mingo's quick actions: its icon in Mingo's accent", () => {
    const all = prompts([LAPTOP, SERVER, WINDOWS_DESKTOP]);
    expect(all.length).toBeGreaterThan(0);
    for (const prompt of all) {
      expect(prompt.icon).toMatchObject({ accent: getAgentAccent('mingo') });
    }
  });
});
