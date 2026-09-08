'use client';

import { memo, Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { ScriptEditor } from '../../shared/components/script-editor';
import { envVarsToStrings, shellToId } from '../../shared/utils/script-mappers';
import { ScriptArgumentsCard } from './script-arguments-card';

/** The script's source, once the query has answered. `null` — it carries none. */
interface ScriptSource {
  body: string;
  shell: string;
}

type SourceState = { status: 'loading' } | { status: 'ready'; source: ScriptSource | null };

const SOURCE_LOADING: SourceState = { status: 'loading' };

/**
 * The part that reads the script, and therefore the part that suspends: the
 * default-args and default-env-var cards, shown only when present.
 *
 * The SOURCE is deliberately not rendered here — it is handed to the tab
 * instead, so the editor below can stay mounted across the wait. See
 * {@link ScriptDetailsTab}.
 *
 * `store-or-network`: the page's header and summary islands revalidated this
 * exact query on load, so this one reads the store instead of refetching the
 * whole script every time the user comes back to this tab.
 */
function ScriptParamCards({ scriptId, onResolved }: { scriptId: string; onResolved: (state: SourceState) => void }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );
  const script = data.script;

  const source = useMemo<ScriptSource | null>(
    () => (script?.scriptBody ? { body: script.scriptBody, shell: shellToId(script.shell) } : null),
    [script],
  );

  // Layout effect: the editor is revealed in the same frame this content is, not
  // a paint later.
  useLayoutEffect(() => {
    onResolved({ status: 'ready', source });
  }, [source, onResolved]);

  // Not-found is reported once, by the summary card above; render nothing here.
  if (!script) {
    return null;
  }

  const args = script.defaultArgs ? [...script.defaultArgs] : [];
  const envVarStrings = envVarsToStrings(script.envVars);
  if (args.length === 0 && envVarStrings.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] lg:grid-cols-2">
      {args.length > 0 ? <ScriptArgumentsCard title="Default Script Arguments" args={args} separator=" " /> : <div />}
      {envVarStrings.length > 0 && <ScriptArgumentsCard title="Default Environment Vars" args={envVarStrings} />}
    </div>
  );
}

/**
 * "Script Details" tab.
 *
 * Carries its own boundary: a tab that suspends is the tab's business, not the
 * page's, so switching to it draws a placeholder and leaves the header, the
 * summary card and the tab strip untouched.
 *
 * The boundary is around the CARDS only. The editor sits outside it and is
 * mounted from the first render with `loading`, so the editor is built while the
 * query is still out and holds its own placeholder until the source arrives —
 * one placeholder for the whole wait, and the editor is never built twice (it
 * would be, if it lived inside the boundary: a fallback and its children are
 * different tree positions).
 *
 * It is dropped once the answer says the script has no body — that is the one
 * case where the block does not belong on the page at all.
 *
 * The cards get NO placeholder, deliberately. Both are optional and independent
 * — plenty of scripts take neither arguments nor environment variables — so a
 * skeleton there promises rows that may never come and then collapses, shoving
 * the editor up by its own height. A placeholder is only owed to content that is
 * certain to arrive; for the rest the honest wait is nothing at all. Nothing is
 * lost by it either: the cards and the script body land in the SAME answer, so
 * they appear in the frame where the editor fills in.
 *
 * `memo` for the reason given in `script-detail-tabs.ts`.
 */
export const ScriptDetailsTab = memo(function ScriptDetailsTabImpl({ scriptId }: { scriptId: string }) {
  const [state, setState] = useState<SourceState>(SOURCE_LOADING);
  const isLoading = state.status === 'loading';
  const source = state.status === 'ready' ? state.source : null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)] pt-[var(--spacing-system-l)]">
      <Suspense fallback={null}>
        <ScriptParamCards scriptId={scriptId} onResolved={setState} />
      </Suspense>

      {(isLoading || source) && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <div className="w-full text-ods-text-secondary text-h5">Syntax</div>
          <ScriptEditor value={source?.body ?? ''} shell={source?.shell} readOnly height="400px" loading={isLoading} />
        </div>
      )}
    </div>
  );
});
ScriptDetailsTab.displayName = 'ScriptDetailsTab';
