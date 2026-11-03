import type { ChatMessage } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { useMemo } from 'react';
import { ASSISTANT_CONFIG, CREATION_SOURCE } from '../constants';

interface FaeFormDialog {
  id: string;
  createdAt?: string;
  title?: string | null;
  description?: string | null;
  creationSource?: string | null;
}

/**
 * The reply a ticket opened from Fae's form starts with: nobody wrote it, so the app does. One object per what it says,
 * because the thread it heads changes on every chunk and the message memo compares parts by reference.
 */
export function useFaeFormMessage(dialog: FaeFormDialog | null | undefined, assistantName: string): ChatMessage | null {
  const id = dialog?.creationSource === CREATION_SOURCE.FAE_FORM ? dialog.id : undefined;
  const createdAt = dialog?.createdAt;
  const title = dialog?.title;
  const description = dialog?.description;

  return useMemo(() => {
    if (id === undefined) return null;
    return {
      id: `synthetic-fae-form-${id}`,
      role: 'assistant',
      metadata: {
        createdAt,
        author: { name: assistantName, assistantType: ASSISTANT_CONFIG.FAE.type, authorType: 'fae' },
      },
      parts: [
        {
          type: 'text',
          text: [
            'Your request has been received. We will contact you shortly.',
            '',
            'Subject:',
            title || '',
            '',
            'Description:',
            description || '(No description provided)',
          ].join('\n'),
        },
      ],
    };
  }, [id, createdAt, title, description, assistantName]);
}
