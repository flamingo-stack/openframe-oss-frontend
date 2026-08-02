'use client';

import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, Suspense } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';
import { scriptDetailRelayQuery } from '@/graphql/scripts/script-detail-relay';
import { ScriptArgumentsCard } from '../../../components/script/script-arguments-card';
import { ScriptEditor } from '../../../components/script/script-editor';
import { envVarsToStrings, shellToId } from '../../shared/utils/script-mappers';

/**
 * The part that reads the script, and therefore the part that suspends: the
 * default-args and default-env-var cards (shown only when present) followed by
 * the read-only source.
 *
 * `store-or-network`: the page's header and summary islands revalidated this
 * exact query on load, so this one reads the store instead of refetching the
 * whole script every time the user comes back to this tab.
 */
function ScriptDetailsTabContent({ scriptId }: { scriptId: string }) {
  const data = useLazyLoadQuery<ScriptDetailQueryType>(
    scriptDetailRelayQuery,
    { id: scriptId },
    { fetchPolicy: 'store-or-network' },
  );
  const script = data.script;

  // Not-found is reported once, by the summary card above; render nothing here.
  if (!script) {
    return null;
  }

  const args = script.defaultArgs ? [...script.defaultArgs] : [];
  const envVarStrings = envVarsToStrings(script.envVars);

  return (
    <div className="flex flex-col gap-6 pt-[var(--spacing-system-l)]">
      {(args.length > 0 || envVarStrings.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {args.length > 0 ? (
            <ScriptArgumentsCard title="Default Script Arguments" args={args} separator=" " />
          ) : (
            <div />
          )}
          {envVarStrings.length > 0 && <ScriptArgumentsCard title="Default Environment Vars" args={envVarStrings} />}
        </div>
      )}

      {script.scriptBody && (
        <div className="flex flex-col gap-1">
          <div className="text-h5 text-ods-text-secondary w-full">Syntax</div>
          <ScriptEditor value={script.scriptBody} shell={shellToId(script.shell)} readOnly height="400px" />
        </div>
      )}
    </div>
  );
}

/** A {@link ScriptArgumentsCard} placeholder: caption label + key——value rows. */
function InfoCardSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] w-full">
      <Skeleton className="h-5 w-44" />
      <div className="bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-m)] flex flex-col gap-[var(--spacing-system-sf)]">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-[var(--spacing-system-xsf)]">
            <Skeleton className="h-5 w-20" />
            <div className="flex-1 h-px bg-ods-border" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The source block before Monaco exists — Syntax label + editor surface. */
function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <Skeleton className="h-5 w-16" />
      <div className="bg-ods-card border border-ods-border rounded-lg p-[var(--spacing-system-mf)] h-[400px] flex flex-col gap-[var(--spacing-system-xsf)]">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${Math.max(20, 80 - i * 5 + ((i * 17) % 30))}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ScriptDetailsTabSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)] pt-[var(--spacing-system-l)]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--spacing-system-lf)]">
        <InfoCardSkeleton />
        <InfoCardSkeleton />
      </div>
      <EditorSkeleton />
    </div>
  );
}

/**
 * "Script Details" tab.
 *
 * Carries its own boundary: a tab that suspends is the tab's business, not the
 * page's, so switching to it draws this skeleton and leaves the header, the
 * summary card and the tab strip untouched.
 *
 * `memo` for the reason given in `script-detail-tabs.ts`.
 */
export const ScriptDetailsTab = memo(function ScriptDetailsTab({ scriptId }: { scriptId: string }) {
  return (
    <Suspense fallback={<ScriptDetailsTabSkeleton />}>
      <ScriptDetailsTabContent scriptId={scriptId} />
    </Suspense>
  );
});
