import type { WhatToAskContent } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { getDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import type { whatToAskDevicesRelayQuery$data } from '@/__generated__/whatToAskDevicesRelayQuery.graphql';

/** An online device a prompt can name (`whatToAskDevicesRelayQuery`). */
export type WhatToAskDevice = whatToAskDevicesRelayQuery$data['devices']['edges'][number]['node'];

const isWorkstation = (device: WhatToAskDevice) => device.type === 'LAPTOP' || device.type === 'DESKTOP';
const isServer = (device: WhatToAskDevice) => device.type === 'SERVER';
const isWindows = (device: WhatToAskDevice) => device.osType === 'WINDOWS';

/**
 * The answer to "What to ask Mingo?": what Mingo does, and a few prompts per
 * kind of work, each backed by one of its admin tools. Three of them name an
 * online device of the workspace that fits (a workstation for "slow", a server
 * for its logs, a Windows device for the print spooler), a different one each
 * while there are enough; without one that fits, the prompt asks without a
 * name. A picked prompt goes into the composer; nothing is sent until the user does.
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
      (fallback ? named.find(fallback) : undefined);
    if (device) used.add(device.id);
    return device ? getDeviceName(device) : null;
  };
  const spoolerDevice = pick(isWindows);
  const logsDevice = pick(isServer, () => true);
  const slowDevice = pick(isWorkstation, () => true);

  return {
    question: 'What can I ask you?',
    reply:
      'Describe the outcome you want. I diagnose, check and fix across every device, and you approve anything that changes a device. Try one:',
    groups: [
      {
        label: 'Diagnose',
        prompts: [
          {
            label: slowDevice
              ? `Why is ${slowDevice} slow? Check CPU, memory and disk`
              : 'Which devices are slow right now? Check CPU, memory and disk',
            icon: { name: 'laptop' },
          },
          {
            label: logsDevice
              ? `Pull error logs from ${logsDevice} for the last hour and tell me what failed`
              : 'Pull error logs from my servers for the last hour and tell me what failed',
            icon: { name: 'clipboard-list' },
          },
          { label: 'Summarize open incidents and which ones need a technician', icon: { name: 'alert-triangle' } },
        ],
      },
      {
        label: 'Check',
        prompts: [
          { label: 'Which devices have critical CVEs this week?', icon: { name: 'shield-check' } },
          { label: 'Which devices are still on an old Chrome version?', icon: { name: 'parcel-02' } },
          { label: 'Which devices went offline today, and when did each drop?', icon: { name: 'monitor' } },
          { label: 'Which open tickets are waiting on a technician right now?', icon: { name: 'ticket' } },
        ],
      },
      {
        label: 'Fix',
        prompts: [
          { label: 'Update Chrome on every device that has it', icon: { name: 'download-01' } },
          {
            label: spoolerDevice
              ? `Clear the print spooler on ${spoolerDevice}`
              : 'Clear the print spooler on a Windows device',
            icon: { name: 'wrench' },
          },
          {
            label: 'Write a script that frees disk space on Windows devices under 10% free, test it on one device',
            icon: { name: 'bracket-curly' },
          },
          { label: 'Create a policy that flags any device with disk encryption turned off', icon: { name: 'radar' } },
        ],
      },
    ],
    note: 'Click one to put it in the composer, then send.',
  };
}
