import type { Message } from '@flamingo-stack/openframe-frontend-core/components/chat';

/** Name the sample end user signs approvals with. */
const SAMPLE_USER_NAME = 'John Smith';

/**
 * Static sample conversation for the read-only chat preview: a fix the client
 * approves, then a hand-off to a technician, so the preview shows the thread
 * blocks and the hand-off bar the Fae window renders for that state.
 */
export function buildFaeChatPreviewMessages(assistantName: string, avatarUrl?: string): Message[] {
  // Fixed time so every message shows the same stamp.
  const at = new Date();
  at.setHours(14, 47, 0, 0);

  const user = { role: 'user' as const, authorType: 'user' as const, timestamp: at };
  const assistant = {
    role: 'assistant' as const,
    name: assistantName,
    assistantType: 'fae' as const,
    avatar: avatarUrl ?? null,
    timestamp: at,
  };

  return [
    { ...user, id: 'preview-1', content: 'My laptop has been running really slowly lately' },
    {
      ...assistant,
      id: 'preview-2',
      content: "I'll run a quick diagnostic to identify what's causing the performance issues.",
    },
    {
      ...assistant,
      id: 'preview-3',
      content: [
        {
          type: 'text',
          text: 'I found that your C: drive is 89% full. I can clean up temporary files to free some space – may I proceed?',
        },
        {
          type: 'approval_request',
          status: 'approved',
          resolvedByName: SAMPLE_USER_NAME,
          data: {
            command: 'Get-ChildItem C:\\temp -Recurse | Remove-Item -Force -Recurse',
            explanation: 'Clear temporary files from C:\\temp to free up disk space',
          },
        },
      ],
    },
    {
      ...assistant,
      id: 'preview-4',
      content: "Complete! I've freed up 2.4 GB of disk space, which should help with performance.",
    },
    { ...user, id: 'preview-5', content: 'Thanks, but Chrome still freezes every few minutes' },
    {
      ...assistant,
      id: 'preview-6',
      content: [
        {
          type: 'text',
          text: "I detected 19 Chrome tabs running under a suspicious parent process that doesn't match your user profile. This could be malware, so I'm handing it to your technician.",
        },
        {
          type: 'ticket_escalated',
          data: {
            ticketId: 'preview-ticket',
            ticketNumber: 1932,
            reason: 'AI_REQUESTED',
            text: 'A technician will review the ticket and reply here when available.',
          },
        },
      ],
    },
  ];
}
