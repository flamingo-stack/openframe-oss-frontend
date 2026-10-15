'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import {
  QuickActionChipSkeleton,
  SuggestionsDisplay,
  type WhatToAskContent,
} from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useEffect, useState } from 'react';
import { useMingoWhatToAsk } from '../hooks/use-mingo-what-to-ask';
import { useMingoChat } from '../providers/mingo-chat-provider';
import { buildMingoWhatToAsk } from '../what-to-ask';

/** The prompts without device names: what the skeleton lays out while the named ones load. */
const UNNAMED = buildMingoWhatToAsk([]);

/**
 * "What to ask Mingo?" on the home (MISSING 2.5): the answer the chat's history list gives
 * the same question — prompts per kind of work, naming the workspace's online devices — in
 * the lib's suggestion chips. A chip sends its prompt in a new chat, as picking one in the
 * chat's new-chat exchange does; the dock then opens that chat.
 */
export function MingoHomeWhatToAsk() {
  const loadWhatToAsk = useMingoWhatToAsk();
  const { chat } = useMingoChat();
  const sendInNewDialog = chat?.sendInNewDialog;
  // Read once per visit, like the list entry reads it per click: a named device is one
  // online now. The loader never rejects (no devices → the prompts without names).
  const [content, setContent] = useState<WhatToAskContent | null>(null);

  useEffect(() => {
    let current = true;
    void loadWhatToAsk().then(loaded => {
      if (current) setContent(loaded);
    });
    return () => {
      current = false;
    };
  }, [loadWhatToAsk]);

  return (
    <section aria-label="What to ask Mingo?" aria-busy={content === null || undefined}>
      <TitleBlock title="What to ask Mingo?" subtitle={(content ?? UNNAMED).reply} />
      {content ? (
        <SuggestionsDisplay
          segment={{
            type: 'suggestions',
            groups: content.groups,
            note: content.note,
            onPick: prompt => {
              void sendInNewDialog?.(prompt);
            },
          }}
        />
      ) : (
        <WhatToAskSkeleton />
      )}
    </section>
  );
}

/**
 * `SuggestionsDisplay`'s layout with a chip skeleton in each chip's place — the captions are
 * known before the device names are, so only the chips wait.
 */
function WhatToAskSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-sf)]">
      {UNNAMED.groups.map(group => (
        <div key={group.label} className="flex min-w-0 flex-col gap-[var(--spacing-system-xs)]">
          <p className="text-ods-text-secondary text-h5">{group.label}</p>
          <div className="flex min-w-0 flex-wrap gap-[var(--spacing-system-xs)]">
            {group.prompts.map(prompt => (
              <QuickActionChipSkeleton key={prompt.label} variant="question" labelCh={prompt.label.length} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
