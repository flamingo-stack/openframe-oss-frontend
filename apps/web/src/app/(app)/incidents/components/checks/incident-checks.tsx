'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { getDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import { SlidersSquareHrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { NoData, PageLayout, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useApiParams } from '@flamingo-stack/openframe-frontend-core/hooks';
import { defineParamSchema } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useState } from 'react';
import { useLazyLoadQuery } from 'react-relay';
import type { incidentChecksRelayQuery as IncidentChecksQueryType } from '@/__generated__/incidentChecksRelayQuery.graphql';
import type { incidentChecksRelayScopeNameQuery as ScopeNameQueryType } from '@/__generated__/incidentChecksRelayScopeNameQuery.graphql';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { useAdminGate } from '@/app/hooks/use-admin-gate';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { incidentChecksRelayQuery, incidentChecksRelayScopeNameQuery } from '@/graphql/insights/incident-checks-relay';
import { useIncidentCheckMutations } from '../../hooks/use-incident-check-mutations';
import { INSIGHT_CHECK_SCOPE_LABELS } from '../../utils/incident-check-labels';
import {
  type CheckScope,
  type CheckSettingDraft,
  GLOBAL_SCOPE,
  type IncidentCheck,
  isCompleteScope,
  isWritableScopeType,
  scopeInput,
  toIncidentChecks,
  withEnabled,
} from '../../utils/incident-check-transform';
import { CheckRow } from './check-row';
import { CheckScopeBar } from './check-scope-bar';
import { EditCheckModal } from './edit-check-modal';

/** The tab's own URL params: which scope it shows (`?scope=CUSTOMER&scopeId=<organizationId>`). */
export const CHECK_SCOPE_PARAMS = defineParamSchema({
  scope: { type: 'string', default: InsightCheckScopeType.GLOBAL },
  scopeId: { type: 'string', default: '' },
});

/** Both at their defaults: what a tab switch resets. */
export const NO_CHECK_SCOPE = {
  scope: InsightCheckScopeType.GLOBAL,
  scopeId: '',
} satisfies Record<keyof typeof CHECK_SCOPE_PARAMS, unknown>;

/** The built-in catalog's size: how many rows the list holds while it loads. */
const CHECKS_SKELETON_ROWS = 15;

const PRECEDENCE_NOTE =
  'A device takes the most specific setting: its own, then its customer’s, then its tags’ (the strictest wins), then all devices’. A change applies from the next run of the check.';

function scopeOf(params: { scope: string; scopeId: string }): CheckScope {
  if (!isWritableScopeType(params.scope) || params.scope === InsightCheckScopeType.GLOBAL) return GLOBAL_SCOPE;
  return { type: params.scope, id: params.scopeId || null };
}

/**
 * Incidents → Checks: every built-in check at one scope, switched on or off and its thresholds
 * set, each value saying where it comes from. Admins and owners change them; everyone else reads.
 */
export function IncidentChecks() {
  const { params, setParams } = useApiParams(CHECK_SCOPE_PARAMS);
  const scope = scopeOf(params);

  return (
    // Inset as the incident lists are. The note is a paragraph, not the subtitle: the subtitle is one clipped line.
    <PageLayout title="Incident Checks" className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <ScopeBar scope={scope} onChange={next => setParams({ scope: next.type, scopeId: next.id ?? '' })} />
          <p className="text-ods-text-secondary text-h6">{PRECEDENCE_NOTE}</p>
        </div>
        {isCompleteScope(scope) ? (
          <ContentErrorBoundary title="Incident Checks" message="Couldn't load the checks." resetKey={scopeKey(scope)}>
            <CheckList scope={scope} />
          </ContentErrorBoundary>
        ) : (
          <NoData
            icon={<SlidersSquareHrIcon />}
            title="Pick what to configure"
            description="Choose a customer, tag or device to see and change its checks."
            className="py-[var(--spacing-system-xxl)]"
          />
        )}
      </div>
    </PageLayout>
  );
}

function scopeKey(scope: CheckScope): string {
  return `${scope.type}:${scope.id ?? ''}`;
}

/** The scope picker, with the picked entity's name read from its id (a link or a reload names it by id only). */
function ScopeBar({ scope, onChange }: { scope: CheckScope; onChange: (scope: CheckScope) => void }) {
  if (scope.id === null) return <CheckScopeBar scope={scope} scopeName={null} onChange={onChange} />;
  return (
    <ContentErrorBoundary fallback={() => <CheckScopeBar scope={scope} scopeName={null} onChange={onChange} />}>
      <NamedScopeBarIsland scope={scope} scopeId={scope.id} onChange={onChange} />
    </ContentErrorBoundary>
  );
}

interface NamedScopeBarProps {
  scope: CheckScope;
  scopeId: string;
  onChange: (scope: CheckScope) => void;
}

/** The named bar with its own boundary: in its scope it is the bar without the name. */
function NamedScopeBarIsland(props: NamedScopeBarProps) {
  return (
    <LoadingSuspense label="Loading scope">
      <NamedScopeBar {...props} />
    </LoadingSuspense>
  );
}

function NamedScopeBar({ scope, scopeId, onChange }: NamedScopeBarProps) {
  if (useLoadingScope()) return <CheckScopeBar scope={scope} scopeName={null} onChange={onChange} />;
  return <NamedScopeBarLive scope={scope} scopeId={scopeId} onChange={onChange} />;
}

function NamedScopeBarLive({ scope, scopeId, onChange }: NamedScopeBarProps) {
  const name = useScopeName(scope, scopeId);
  return <CheckScopeBar scope={scope} scopeName={name} onChange={onChange} />;
}

/** The customer's, device's or tag's name, or null when it no longer resolves. */
function useScopeName(scope: CheckScope, scopeId: string): string | null {
  const data = useLazyLoadQuery<ScopeNameQueryType>(
    incidentChecksRelayScopeNameQuery,
    {
      organizationId: scopeId,
      machineId: scopeId,
      tagId: scopeId,
      isCustomer: scope.type === InsightCheckScopeType.CUSTOMER,
      isDevice: scope.type === InsightCheckScopeType.DEVICE,
      isTag: scope.type === InsightCheckScopeType.TAG,
    },
    { fetchPolicy: 'store-or-network' },
  );
  if (scope.type === InsightCheckScopeType.CUSTOMER) return data.organizationByOrganizationId?.name ?? null;
  if (scope.type === InsightCheckScopeType.DEVICE) return data.device ? getDeviceName(data.device) || null : null;
  return data.node?.key ?? null;
}

const CHECK_SKELETON = Array.from({ length: CHECKS_SKELETON_ROWS }, (_, row) => `check-skeleton-${row}`).map(key => (
  <CheckRow key={key} scope={GLOBAL_SCOPE} canEdit={false} />
));

/** The list at one scope, with its own boundary: in its scope it draws its rows as bars. */
function CheckList({ scope }: { scope: CheckScope }) {
  return (
    <LoadingSuspense label="Loading checks">
      <CheckListReader scope={scope} />
    </LoadingSuspense>
  );
}

function CheckListReader({ scope }: { scope: CheckScope }) {
  if (useLoadingScope()) return <CheckListFrame>{CHECK_SKELETON}</CheckListFrame>;
  return <CheckListLive scope={scope} />;
}

function CheckListFrame({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">{children}</div>;
}

function CheckListLive({ scope }: { scope: CheckScope }) {
  const retryKey = useRetryKey();
  const data = useLazyLoadQuery<IncidentChecksQueryType>(incidentChecksRelayQuery, scopeInput(scope), {
    fetchPolicy: 'store-and-network',
    fetchKey: retryKey,
  });
  const checks = toIncidentChecks(data.insightChecks);
  const admin = useAdminGate();
  const canEdit = admin === 'admin';
  const { save, reset, isSaving, isPending } = useIncidentCheckMutations(scope);
  const [editing, setEditing] = useState<IncidentCheck | null>(null);

  const write = (check: IncidentCheck, draft: CheckSettingDraft, successDescription: string, onSaved?: () => void) =>
    save(check, draft, { successDescription, onSaved });

  return (
    <>
      {admin === 'not-admin' && (
        <p className="text-ods-text-secondary text-h6">Only admins and owners can change incident checks.</p>
      )}
      <CheckListFrame>
        {checks.map(check => (
          <CheckRow
            key={check.check}
            check={check}
            scope={scope}
            canEdit={canEdit}
            busy={isPending(check.check)}
            onToggle={(target, enabled) =>
              write(target, withEnabled(target, scope, enabled), `${enabled ? 'Turned on' : 'Turned off'} here.`)
            }
            onEdit={setEditing}
            onReset={target => reset(target, { successDescription: 'Now inherits every setting.' })}
          />
        ))}
      </CheckListFrame>
      {editing && (
        <EditCheckModal
          key={editing.check}
          check={editing}
          scope={scope}
          scopeName={
            scope.type === InsightCheckScopeType.GLOBAL
              ? 'all devices'
              : `this ${INSIGHT_CHECK_SCOPE_LABELS[scope.type].toLowerCase()}`
          }
          isSaving={isSaving}
          onClose={() => setEditing(null)}
          onSave={draft => write(editing, draft, 'Applies from the next run of the check.', () => setEditing(null))}
        />
      )}
    </>
  );
}
