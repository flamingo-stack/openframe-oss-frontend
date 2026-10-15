import type { SuggestionPrompt, WhatToAskContent } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { getDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { whatToAskDevicesRelayQuery$data } from '@/__generated__/whatToAskDevicesRelayQuery.graphql';
import { decodeGlobalId } from '@/lib/relay-id';
import { CONTEXT_ENTITY_MARKER } from './context/context-types';

/** An online device a prompt can name (`whatToAskDevicesRelayQuery`). */
export type WhatToAskDevice = whatToAskDevicesRelayQuery$data['devices']['edges'][number]['node'];

const isWorkstation = (device: WhatToAskDevice) => device.type === 'LAPTOP' || device.type === 'DESKTOP';
const isServer = (device: WhatToAskDevice) => device.type === 'SERVER';
const isWindows = (device: WhatToAskDevice) => device.osType === 'WINDOWS';

/**
 * A prompt about one device: the chip shows the device's name, the message
 * carries the device's `@device:<id>` mention - the token the composer's own
 * @-mention commits - so Mingo knows exactly which device is meant even when
 * several share the name (hostnames repeat across a fleet).
 */
const aboutDevice = (
  device: WhatToAskDevice | null,
  named: (name: string) => string,
  unnamed: string,
  icon: SuggestionPrompt['icon'],
): SuggestionPrompt => {
  if (!device) return { label: unnamed, icon };
  const id = decodeGlobalId(device.id)?.rawId ?? device.machineId;
  return { label: named(getDeviceName(device)), prompt: named(`@${CONTEXT_ENTITY_MARKER.DEVICE}:${id}`), icon };
};

/**
 * The answer to "What to ask Mingo?": what Mingo does, and a few prompts per
 * kind of work, each one a question Mingo's admin tools can answer. Four of
 * them name an online device of the workspace that fits (a workstation for
 * "slow", a server for its logs, a Windows device for the print spooler, any
 * for the DNS cache), a different one each while there are enough; without one
 * that fits, the prompt asks without a name. A picked prompt is sent in that
 * chat, like a quick action.
 */
export function buildMingoWhatToAsk(devices: readonly WhatToAskDevice[]): WhatToAskContent {
  const named = devices.filter(device => getDeviceName(device));
  const used = new Set<string>();
  // The most particular pick goes first, so a looser one cannot take its only fit.
  const pick = (fits: (device: WhatToAskDevice) => boolean, fallback?: (device: WhatToAskDevice) => boolean) => {
    const device =
      named.find(d => fits(d) && !used.has(d.id)) ??
      (fallback ? named.find(d => fallback(d) && !used.has(d.id)) : undefined) ??
      named.find(fits) ??
      (fallback ? named.find(fallback) : undefined) ??
      null;
    if (device) used.add(device.id);
    return device;
  };
  const spoolerDevice = pick(isWindows);
  const logsDevice = pick(isServer, () => true);
  const slowDevice = pick(isWorkstation, () => true);
  const dnsDevice = pick(() => true);

  return {
    question: 'What can I ask you?',
    reply:
      'Describe the outcome you want. I diagnose, check and fix across every device, and you approve anything that changes a device. Try one:',
    groups: [
      {
        label: 'Diagnose',
        prompts: [
          aboutDevice(
            slowDevice,
            name => `Why is ${name} slow? Check CPU, memory and disk`,
            'Which devices are slow right now? Check CPU, memory and disk',
            { name: 'laptop' },
          ),
          aboutDevice(
            logsDevice,
            name => `Pull error logs from ${name} for the last hour and tell me what failed`,
            'Pull error logs from my servers for the last hour and tell me what failed',
            { name: 'clipboard-list' },
          ),
          { label: 'Summarize open incidents and which ones need a technician', icon: { name: 'alert-triangle' } },
        ],
      },
      {
        label: 'Check',
        prompts: [
          { label: 'Which devices have critical CVEs this week?', icon: { name: 'shield-check' } },
          { label: 'Which devices are still on an old Chrome version?', icon: { name: 'parcel-02' } },
          { label: 'Which devices are offline right now?', icon: { name: 'monitor' } },
          { label: 'Which open tickets are waiting on a technician right now?', icon: { name: 'ticket' } },
        ],
      },
      {
        label: 'Fix',
        prompts: [
          aboutDevice(
            dnsDevice,
            name => `Flush the DNS cache on ${name}`,
            'Flush the DNS cache on a device that cannot load websites',
            { name: 'globe-01' },
          ),
          aboutDevice(
            spoolerDevice,
            name => `Clear the print spooler on ${name}`,
            'Clear the print spooler on a Windows device',
            { name: 'wrench' },
          ),
          {
            label: 'Write a script that frees disk space on Windows devices under 10% free, test it on one device',
            icon: { name: 'bracket-curly' },
          },
          { label: 'Create a policy that flags any device with disk encryption turned off', icon: { name: 'radar' } },
        ],
      },
    ],
  };
}
