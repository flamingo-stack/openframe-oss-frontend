'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { ScriptSummaryCardSkeleton } from './script-summary-card';

/**
 * One label-width action placeholder, which is what the header settles into
 * either way: an active script offers "Run Script" (plus Edit in the "..."
 * menu), an archived one a single "Unarchive".
 *
 * WHICH of the two is the record's answer, so the header cannot draw a real
 * button without guessing — and guessing here is worse than an empty slot: a
 * live-looking "Run Script" under the cursor would turn into "Unarchive" the
 * moment the answer lands. `loadingActions` renders the neutral bar the design
 * system already defines for exactly this, sized off these entries.
 */
const LOADING_ACTIONS: PageActionButton[] = [{ label: 'Script action' }];

/**
 * The script details header while the record is in flight — the REAL
 * `TitleBlock`, so it is pixel-identical in height to the loaded one and the
 * Back button already works. The title is static, so it needs no placeholder at
 * all; only the action slot waits.
 */
export function ScriptHeaderSkeleton() {
  const handleBack = useSafeBack(routes.scripts.list);

  return (
    <TitleBlock
      title="Script Details"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={LOADING_ACTIONS}
      loadingActions
      actionsVariant="menu-primary"
    />
  );
}

/** The tag chips and the summary card before the script lands. */
export function ScriptSummarySkeleton() {
  return <ScriptSummaryCardSkeleton />;
}
