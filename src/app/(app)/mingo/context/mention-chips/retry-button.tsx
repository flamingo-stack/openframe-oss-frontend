'use client';

/**
 * The Retry action under a Mingo turn that ended on an error (see
 * `utils/retry-turn.ts` for why it rides the mention slot). `renderMention` is a
 * module-level function, so the handler reaches the button through context: the
 * host provides it around `<EmbeddableChat>`, and null means nothing to retry.
 */

import { Refresh01LeftIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { createContext, useContext } from 'react';

export const MingoRetryContext = createContext<(() => void) | null>(null);

export function MingoRetryButton() {
  const retry = useContext(MingoRetryContext);
  if (!retry) return null;

  // Inline: the token sits in a markdown paragraph, so the button must not break the `<p>`.
  return (
    <Button
      type="button"
      variant="outline"
      size="small"
      onClick={retry}
      leftIcon={<Refresh01LeftIcon size={16} />}
      className="align-middle"
      data-attr="mingo-chat-retry"
    >
      Retry
    </Button>
  );
}
