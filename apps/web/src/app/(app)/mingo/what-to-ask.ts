import type { WhatToAskContent } from '@flamingo-stack/openframe-frontend-core/components/chat';

/**
 * The answer to "What to ask Mingo?": what Mingo does, and a few prompts per
 * kind of work, each backed by one of its admin tools. A picked prompt goes
 * into the composer; nothing is sent until the user does.
 */
export const MINGO_WHAT_TO_ASK: WhatToAskContent = {
  question: 'What can I ask you?',
  reply:
    'Describe the outcome you want. I diagnose, check and fix across every device, and you approve anything that changes a device. Try one:',
  groups: [
    {
      label: 'Diagnose',
      prompts: [
        { label: 'Why is ROMAN-MBP slow? Check CPU, memory and disk', icon: { name: 'laptop' } },
        {
          label: 'Pull error logs from LAB-SRV-02 for the last hour and tell me what failed',
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
        { label: 'Clear the print spooler on ACME-WS-07', icon: { name: 'wrench' } },
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
