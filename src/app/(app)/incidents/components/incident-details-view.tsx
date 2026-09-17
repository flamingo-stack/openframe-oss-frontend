'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { MingoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons';
import { TagIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { PageActionButton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, type ReactNode, Suspense } from 'react';
import { NotesSectionSkeleton } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { InsightStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import { useTrackOpenView } from '../../mingo/context/use-track-open-view';
import { useMingoLauncherStore } from '../../mingo/stores/mingo-launcher-store';
import { useIncident } from '../hooks/use-incident';
import { useIncidentTransitions } from '../hooks/use-incident-transitions';
import { incidentMingoDraft } from '../utils/fix-with-mingo-prompt';
import { INCIDENT_TRANSITION_ACTIONS, transitionsFrom } from '../utils/incident-labels';
import { IncidentAssignee } from './incident-assignee';
import { IncidentNotes } from './incident-notes';
import { IncidentQueryResults } from './incident-query-results';
import { IncidentSummaryCard, IncidentSummaryCardSkeleton } from './incident-summary-card';
import { SnoozeIncidentModal } from './snooze-incident-modal';
import { transitionMenuItems } from './transition-menu-items';

interface IncidentDetailsViewProps {
  incidentId: string;
}

/**
 * The description travels to the new-ticket form in the URL. Detecting-query
 * descriptions are a paragraph, but nothing caps them, and a query string past
 * a few KB is refused by the gateway rather than degraded — so the prefill
 * carries the head of it and the form keeps the rest editable.
 */
const TICKET_PREFILL_DESCRIPTION_MAX = 1000;

/**
 * The header island. The title is static, but the action set is the record's
 * own answer — which transitions are legal depends on its status — so this is
 * what waits for it.
 */
function IncidentHeader({ incidentId }: IncidentDetailsViewProps) {
  const incident = useIncident(incidentId);

  const handleBack = useSafeBack(routes.incidents.list);
  const canOpenMingo = useMingoLauncherStore(state => state.canOpen);
  // Mingo's "open view": this incident rides on every message sent while the page is up.
  useTrackOpenView({ type: CONTEXT_ENTITY_KIND.INSIGHT, id: incident.id, label: incident.title });
  const { transition, snoozeTarget, cancelSnooze, confirmSnooze, isMutating, isSnoozing } = useIncidentTransitions();

  // The status button is named after the transition the technician most likely
  // wants — Resolve while the incident is open — and its menu lists every legal
  // one (design: "Resolve ▾"). A resolved incident offers Archive / Reopen.
  const targets = transitionsFrom(incident.status);
  const primary = targets.includes(InsightStatus.RESOLVED) ? InsightStatus.RESOLVED : targets[0];
  // A deleted assignee is not offered by the ticket picker — the ticket starts unassigned.
  const ticketAssignee = incident.assignee && !incident.assignee.deleted ? incident.assignee : undefined;

  const actions: PageActionButton[] = [
    {
      label: 'Fix with Mingo',
      variant: 'outline',
      icon: (
        <MingoIcon
          className="size-5"
          eyesColor="var(--ods-flamingo-cyan-base)"
          cornerColor="var(--ods-flamingo-cyan-base)"
        />
      ),
      onClick: () => useMingoLauncherStore.getState().draftToMingo(incidentMingoDraft(incident)),
      disabled: !canOpenMingo,
    },
    {
      label: 'Create Ticket',
      variant: 'outline',
      icon: <TagIcon className="text-ods-text-secondary" />,
      href: routes.tickets.new({
        title: incident.title,
        description: incident.description?.slice(0, TICKET_PREFILL_DESCRIPTION_MAX),
        organizationId: incident.organizationId,
        organizationName: incident.organizationName || undefined,
        deviceId: incident.machineId,
        deviceName: incident.deviceName,
        assigneeId: ticketAssignee?.id,
        assigneeName: ticketAssignee?.name,
      }),
    },
    ...(primary
      ? [
          {
            label: INCIDENT_TRANSITION_ACTIONS[primary].label,
            variant: 'outline' as const,
            disabled: isMutating,
            submenu: transitionMenuItems(incident, transition, isMutating),
          },
        ]
      : []),
  ];

  return (
    <>
      <TitleBlock
        title="Incident Details"
        backButton={{ label: 'Back', onClick: handleBack }}
        actions={actions}
        actionsVariant="icon-buttons"
      />
      <SnoozeIncidentModal
        key={snoozeTarget?.id ?? 'closed'}
        open={snoozeTarget !== null}
        onOpenChange={open => !open && cancelSnooze()}
        onConfirm={confirmSnooze}
        isPending={isSnoozing}
      />
    </>
  );
}

/** The summary card — the same record as the header (see `useIncident`). */
function IncidentSummary({ incidentId }: IncidentDetailsViewProps) {
  const incident = useIncident(incidentId);
  return <IncidentSummaryCard incident={incident} assigneeSlot={<IncidentAssignee incident={incident} />} />;
}

/** The evidence table, on the same record. */
function IncidentEvidence({ incidentId }: IncidentDetailsViewProps) {
  const incident = useIncident(incidentId);
  return <IncidentQueryResults incident={incident} />;
}

/** Three label-width placeholders: the header settles into Fix with Mingo, Create Ticket and the status button. */
const LOADING_ACTIONS: PageActionButton[] = [
  { label: 'Fix with Mingo' },
  { label: 'Create Ticket' },
  { label: 'Resolve' },
];

function IncidentHeaderSkeleton() {
  const handleBack = useSafeBack(routes.incidents.list);
  return (
    <TitleBlock
      title="Incident Details"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={LOADING_ACTIONS}
      loadingActions
      actionsVariant="icon-buttons"
    />
  );
}

/** `PageLayout`'s two boxes, composed by hand so each island can wait on its own. */
function IncidentDetailsFrame({ header, body }: { header: ReactNode; body: ReactNode }) {
  return (
    <div className="flex w-full flex-col px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      {header}
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-l)]">{body}</div>
    </div>
  );
}

/** The whole page before it may render at all (the feature flag still unanswered). */
export function IncidentDetailsSkeleton() {
  return (
    <IncidentDetailsFrame
      header={<IncidentHeaderSkeleton />}
      body={
        <>
          <IncidentSummaryCardSkeleton />
          <NotesSectionSkeleton />
        </>
      }
    />
  );
}

/**
 * Incident details page. Composes the frozen `TitleBlock` by hand (not
 * `PageLayout`) so only the pieces that read the record suspend — the same
 * shape as the script details page.
 */
export const IncidentDetailsView = memo(function IncidentDetailsViewImpl({ incidentId }: IncidentDetailsViewProps) {
  return (
    <IncidentDetailsFrame
      header={
        <Suspense fallback={<IncidentHeaderSkeleton />}>
          <IncidentHeader incidentId={incidentId} />
        </Suspense>
      }
      body={
        // Notes sit between the card and the evidence but fetch on their own —
        // they need only the id, so they do not wait behind the record.
        <>
          <Suspense fallback={<IncidentSummaryCardSkeleton />}>
            <IncidentSummary incidentId={incidentId} />
          </Suspense>
          <IncidentNotes incidentId={incidentId} />
          <Suspense fallback={null}>
            <IncidentEvidence incidentId={incidentId} />
          </Suspense>
        </>
      }
    />
  );
});
IncidentDetailsView.displayName = 'IncidentDetailsView';
