import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';

/** Name the sample end user signs approvals with. */
const SAMPLE_USER_NAME = 'John Smith';

/**
 * Static sample conversation for the read-only chat preview: a fix the client
 * approves, then a hand-off to a technician, so the preview shows the thread
 * blocks and the hand-off bar the Fae window renders for that state.
 */
export function buildFaeChatPreviewMessages(assistantName: string, avatarUrl?: string): ChatMessage[] {
  // Fixed time so every message shows the same stamp.
  const at = new Date();
  at.setHours(14, 47, 0, 0);
  const createdAt = at.toISOString();

  const user = (id: string, text: string): ChatMessage => ({
    id,
    role: 'user',
    metadata: { createdAt, author: { authorType: 'user' } },
    parts: [{ type: 'text', text }],
  });
  const assistant = (id: string, parts: ChatMessage['parts']): ChatMessage => ({
    id,
    role: 'assistant',
    metadata: { createdAt, author: { name: assistantName, assistantType: 'fae', avatar: avatarUrl ?? null } },
    parts,
  });

  return [
    user('preview-1', 'My laptop has been running really slowly lately'),
    assistant('preview-2', [
      { type: 'text', text: "I'll run a quick diagnostic to identify what's causing the performance issues." },
    ]),
    assistant('preview-3', [
      {
        type: 'text',
        text: 'I found that your C: drive is 89% full. I can clean up temporary files to free some space. May I proceed?',
      },
      {
        type: 'dynamic-tool',
        toolName: 'command',
        toolCallId: 'preview-approval',
        title: 'Get-ChildItem C:\\temp -Recurse | Remove-Item -Force -Recurse',
        toolMetadata: { resolvedByName: SAMPLE_USER_NAME },
        state: 'approval-responded',
        input: {},
        approval: {
          id: 'preview-approval',
          requestReason: 'Clear temporary files from C:\\temp to free up disk space',
          approved: true,
        },
      },
    ]),
    assistant('preview-4', [
      { type: 'text', text: "Complete! I've freed up 2.4 GB of disk space, which should help with performance." },
    ]),
    user('preview-5', 'Thanks, but Chrome still freezes every few minutes'),
    assistant('preview-6', [
      {
        type: 'text',
        text: "I detected 19 Chrome tabs running under a suspicious parent process that doesn't match your user profile. This could be malware, so I'm handing it to your technician.",
      },
      {
        type: 'data-ticket-escalated',
        data: {
          ticketId: 'preview-ticket',
          ticketNumber: 1932,
          reason: 'AI_REQUESTED',
          text: 'A technician will review the ticket and reply here when available.',
        },
      },
    ]),
  ];
}
