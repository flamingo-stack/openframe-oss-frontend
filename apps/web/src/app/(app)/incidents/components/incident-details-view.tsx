'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { AgentMark, LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { TagIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type PageActionButton, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { memo, type ReactNode } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { InsightStatus } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import { useTrackOpenView } from '../../mingo/context/use-track-open-view';
import { mingoActionFor, useFixWithMingo } from '../hooks/use-fix-with-mingo';
import { useIncident, useIncidentDetail } from '../hooks/use-incident';
import { useLatestIncidentDialog } from '../hooks/use-incident-dialogs';
import { useIncidentTransitions } from '../hooks/use-incident-transitions';
import { INCIDENT_TRANSITION_ACTIONS } from '../utils/incident-labels';
import { type Incident, type IncidentTransitionTable, transitionsFrom } from '../utils/incident-transform';
import { IncidentAssignedTickets } from './incident-assigned-tickets';
import { IncidentAssignee } from './incident-assignee';
import { IncidentNotes } from './incident-notes';
import { IncidentQueryResults } from './incident-query-results';
import { IncidentSummaryCard } from './incident-summary-card';
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
 * The header island, with its own boundary. The title is static, but the action set is the record's
 * own answer — which transitions are legal depends on its status — so this is
 * what waits for it.
 */
function IncidentHeader(props: IncidentDetailsViewProps) {
  return (
    <LoadingSuspense label="Loading incident">
      <IncidentHeaderReader {...props} />
    </LoadingSuspense>
  );
}

function IncidentHeaderReader(props: IncidentDetailsViewProps) {
  // In a loading scope (its boundary's fallback, or an outer loading state) it draws itself with no data and runs no read.
  if (useLoadingScope()) return <IncidentHeaderView />;
  return <IncidentHeaderLive {...props} />;
}

function IncidentHeaderLive({ incidentId }: IncidentDetailsViewProps) {
  const { incident, transitions } = useIncidentDetail(incidentId);
  return <IncidentHeaderView incident={incident} transitions={transitions} />;
}

interface IncidentHeaderViewProps {
  /** Absent while the record loads: the header draws its own skeleton. */
  incident?: Incident;
  transitions?: IncidentTransitionTable;
}

const MINGO_ICON = <AgentMark agent="mingo" className="size-5" />;
const CREATE_TICKET_ICON = <TagIcon className="text-ods-text-secondary" />;

/** What the header settles into, inert while the record loads: Fix with Mingo, Create Ticket, the status button. */
const LOADING_ACTIONS: PageActionButton[] = [
  { label: 'Fix with Mingo', variant: 'outline', icon: MINGO_ICON },
  { label: 'Create Ticket', variant: 'outline', icon: CREATE_TICKET_ICON },
  { label: 'Resolve', variant: 'outline' },
];

/**
 * The header over a record. Without one (or in a loading scope) the same header draws itself: the static title and
 * back button real, the record's actions as placeholders. The loaded actions read the record's chat (a suspending
 * query), so they live in their own component under the same title block.
 */
function IncidentHeaderView({ incident, transitions }: IncidentHeaderViewProps) {
  const loading = useLoadingScope() || !incident || !transitions;
  if (loading) return <IncidentTitleBlock actions={LOADING_ACTIONS} loading />;
  return <IncidentHeaderLoaded incident={incident} transitions={transitions} />;
}

/** The page's title block, loaded or loading: the static title, Back to the list, the actions given. */
function IncidentTitleBlock({ actions, loading = false }: { actions: PageActionButton[]; loading?: boolean }) {
  const handleBack = useSafeBack(routes.incidents.list);
  return (
    <TitleBlock
      title="Incident Details"
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      loadingActions={loading}
      actionsVariant="icon-buttons"
    />
  );
}

function IncidentHeaderLoaded({ incident, transitions }: Required<IncidentHeaderViewProps>) {
  const mingoControls = useFixWithMingo();
  // One Mingo button: reopen the chat already started from this incident, or start one.
  const mingoSession = useLatestIncidentDialog(incident.insightId);
  // Mingo's "open view": this incident rides on every message sent while the page is up.
  useTrackOpenView({ type: CONTEXT_ENTITY_KIND.INSIGHT, id: incident.insightId, label: incident.title });
  const { transition, snoozeTarget, cancelSnooze, confirmSnooze, isMutating, isSnoozing } = useIncidentTransitions();

  // The status button is named after the transition the technician most likely
  // wants — Resolve while the incident is open — and its menu lists every legal
  // one (design: "Resolve ▾"). A resolved incident offers Archive, an archived one Reopen.
  const targets = transitionsFrom(transitions, incident.status);
  const primary = targets.includes(InsightStatus.RESOLVED) ? InsightStatus.RESOLVED : targets[0];
  // A deleted assignee is not offered by the ticket picker — the ticket starts unassigned.
  const ticketAssignee = incident.assignee && !incident.assignee.deleted ? incident.assignee : undefined;

  const mingoAction: PageActionButton = {
    ...mingoActionFor(incident, mingoSession, mingoControls),
    variant: 'outline',
    icon: MINGO_ICON,
  };

  const actions: PageActionButton[] = [
    mingoAction,
    {
      label: 'Create Ticket',
      variant: 'outline',
      icon: CREATE_TICKET_ICON,
      href: routes.tickets.new({
        title: incident.title,
        description: incident.description?.slice(0, TICKET_PREFILL_DESCRIPTION_MAX),
        organizationId: incident.organizationId,
        organizationName: incident.organizationName || undefined,
        deviceId: incident.machineId,
        deviceName: incident.deviceName,
        assigneeId: ticketAssignee?.id,
        assigneeName: ticketAssignee?.name,
        insightId: incident.insightId,
        insightTitle: incident.title,
      }),
    },
    ...(primary
      ? [
          {
            label: INCIDENT_TRANSITION_ACTIONS[primary].label,
            variant: 'outline' as const,
            disabled: isMutating,
            submenu: transitionMenuItems(incident, transitions, transition, isMutating),
          },
        ]
      : []),
  ];

  return (
    <>
      <IncidentTitleBlock actions={actions} />
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

/** The summary card: the same record as the header (see `useIncident`), with its own boundary. */
function IncidentSummary(props: IncidentDetailsViewProps) {
  return (
    <LoadingSuspense label="Loading incident summary">
      <IncidentSummaryReader {...props} />
    </LoadingSuspense>
  );
}

function IncidentSummaryReader(props: IncidentDetailsViewProps) {
  // In a loading scope it draws itself with no data and runs no read.
  if (useLoadingScope()) return <IncidentSummaryCard assigneeSlot={<IncidentAssignee />} />;
  return <IncidentSummaryLive {...props} />;
}

function IncidentSummaryLive({ incidentId }: IncidentDetailsViewProps) {
  const incident = useIncident(incidentId);
  return <IncidentSummaryCard incident={incident} assigneeSlot={<IncidentAssignee incident={incident} />} />;
}

/** The evidence table, on the same record, with its own boundary. */
function IncidentEvidence(props: IncidentDetailsViewProps) {
  return (
    <LoadingSuspense label="Loading query results">
      <IncidentEvidenceReader {...props} />
    </LoadingSuspense>
  );
}

function IncidentEvidenceReader(props: IncidentDetailsViewProps) {
  // In a loading scope it draws itself with no data and runs no read.
  if (useLoadingScope()) return <IncidentQueryResults />;
  return <IncidentEvidenceLive {...props} />;
}

function IncidentEvidenceLive({ incidentId }: IncidentDetailsViewProps) {
  const incident = useIncident(incidentId);
  return <IncidentQueryResults incident={incident} />;
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

/**
 * Incident details page. Composes the frozen `TitleBlock` by hand (not
 * `PageLayout`) so only the pieces that read the record suspend — the same
 * shape as the script details page.
 */
export const IncidentDetailsView = memo(function IncidentDetailsViewImpl({ incidentId }: IncidentDetailsViewProps) {
  // In a loading scope (the feature flag still unanswered) nothing may read: every part draws itself without data.
  if (useLoadingScope()) {
    return (
      <IncidentDetailsFrame
        header={<IncidentHeaderView />}
        body={
          <>
            <IncidentSummaryCard assigneeSlot={<IncidentAssignee />} />
            <IncidentNotes incidentId={incidentId} />
            <IncidentQueryResults />
          </>
        }
      />
    );
  }
  return (
    <IncidentDetailsFrame
      header={<IncidentHeader incidentId={incidentId} />}
      body={
        // Notes sit between the card and the evidence but fetch on their own:
        // they need only the id, so they do not wait behind the record. The
        // assigned tickets come last: most incidents have none, so the section
        // appears with its rows below everything the page always shows.
        <>
          <IncidentSummary incidentId={incidentId} />
          <IncidentNotes incidentId={incidentId} />
          <IncidentEvidence incidentId={incidentId} />
          <IncidentAssignedTickets incidentId={incidentId} />
        </>
      }
    />
  );
});
IncidentDetailsView.displayName = 'IncidentDetailsView';
