import { getApprovalMeta, type Notification } from '@flamingo-stack/openframe-frontend-core';
import {
  packageManagerLabel,
  providerMark,
  softwareActionCopy,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { IncidentRow } from '@/app/(app)/incidents/utils/incident-transform';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import { getTicketDeviceName } from '@/app/(app)/tickets/utils/ticket-device-name';
import { formatTicketRef } from '@/app/(app)/tickets/utils/ticket-ref';
import { resolveNotificationRoute } from '@/app/components/notifications/notification-navigation';
import { isApprovalResolved } from '@/graphql/notifications/notification-attributes';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { formatCount } from '@/lib/format-number';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';

/**
 * "Needs you" on Mingo's home: one card listing what waits for a person, composed on the
 * client from six existing contracts (FE_PROMPT §3.2, §12.2) — there is no combined feed.
 * This module is the card's logic as plain data: which source may add how many rows, in
 * what order, what each row says, and when the card loads, hides or reports a failure.
 */

/** The sources, in the order their rows appear on the card. */
export const NEEDS_YOU_SOURCES = ['approvals', 'incidents', 'tickets', 'tenants', 'software', 'disk'] as const;
export type NeedsYouSource = (typeof NEEDS_YOU_SOURCES)[number];

/** How many rows each source may put on the card. */
export const NEEDS_YOU_CAPS = {
  approvals: 2,
  incidents: 2,
  tickets: 2,
  tenants: 1,
  software: 1,
  disk: 1,
} as const satisfies Record<NeedsYouSource, number>;

/** What a row is about — it picks the row's icon. */
export type NeedsYouEntity = 'approval' | 'incident' | 'ticket' | 'tenant' | 'software' | 'device';

export interface NeedsYouRow {
  /** Unique on the card. */
  key: string;
  entity: NeedsYouEntity;
  /** The device's type, for a `device` row's icon. */
  deviceType?: string | null;
  name: string;
  /** The secondary line. */
  detail: string;
  /** The tag on the right: why it needs a person. */
  reason: string;
  /** `error` for a failure, a critical finding, an escalation or a disconnect; `warning` otherwise. */
  tone: 'error' | 'warning';
  /** The entity's page. */
  href: string;
  /**
   * The things this row stands for (`ticket:<id>`, `insight:<id>`). A thing already on the
   * card is not listed twice: a later source's row naming it is skipped, and the next one
   * of that source takes its place.
   */
  subjects: readonly string[];
}

/** What a source has said so far. */
export type SourceReport =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** Every candidate the source found, best first — the card applies the cap. */
      rows: readonly NeedsYouRow[];
      /** A total the footer prints (incidents: every NEW incident). */
      count?: number;
    }
  | { status: 'error'; isOffline: boolean; retry: () => void };

export type NeedsYouGates = Record<NeedsYouSource, FeatureFlagGate>;
export type NeedsYouReports = Partial<Record<NeedsYouSource, SourceReport>>;
export type ReportSource = (source: NeedsYouSource, report: SourceReport) => void;

export interface NeedsYouFailure {
  source: NeedsYouSource;
  isOffline: boolean;
  retry: () => void;
}

export type NeedsYouView =
  | { status: 'loading' }
  /** Every source answered and nothing needs the user. */
  | { status: 'hidden' }
  | { status: 'ready'; rows: NeedsYouRow[]; failures: NeedsYouFailure[] };

/**
 * The card from what the sources said.
 *
 * - **Loading** while any gate is unanswered, any source behind an open gate has not
 *   answered, or `pending` (the footer's own counts) holds. Rows from early sources are
 *   not shown ahead of the rest: they would move when a source above them lands.
 * - **Hidden** once everything answered with nothing. A source that FAILED keeps the card
 *   up with its failure line: "nothing needs you" is a claim a failed source cannot back.
 * - A source behind a gate that is off contributes nothing and is not waited for.
 */
export function resolveNeedsYou(gates: NeedsYouGates, reports: NeedsYouReports, pending = false): NeedsYouView {
  let loading = pending;
  const rows: NeedsYouRow[] = [];
  const failures: NeedsYouFailure[] = [];
  const listed = new Set<string>();

  for (const source of NEEDS_YOU_SOURCES) {
    const gate = gates[source];
    if (gate === 'off') continue;
    const report = reports[source];
    if (gate === 'loading' || !report || report.status === 'loading') {
      loading = true;
      continue;
    }
    if (report.status === 'error') {
      failures.push({ source, isOffline: report.isOffline, retry: report.retry });
      continue;
    }

    let taken = 0;
    for (const row of report.rows) {
      if (taken === NEEDS_YOU_CAPS[source]) break;
      if (row.subjects.some(subject => listed.has(subject))) continue;
      for (const subject of row.subjects) listed.add(subject);
      rows.push(row);
      taken += 1;
    }
  }

  if (loading) return { status: 'loading' };
  if (rows.length === 0 && failures.length === 0) return { status: 'hidden' };
  return { status: 'ready', rows, failures };
}

function sameRow(a: NeedsYouRow, b: NeedsYouRow): boolean {
  return (
    a.key === b.key &&
    a.entity === b.entity &&
    a.deviceType === b.deviceType &&
    a.name === b.name &&
    a.detail === b.detail &&
    a.reason === b.reason &&
    a.tone === b.tone &&
    a.href === b.href &&
    a.subjects.length === b.subjects.length &&
    a.subjects.every((subject, index) => subject === b.subjects[index])
  );
}

/**
 * Whether a report says nothing new. The card keeps the previous one then, so a source
 * re-reporting the same rows (a refetch that changed nothing) does not re-render it.
 */
export function sameReport(previous: SourceReport | undefined, next: SourceReport): boolean {
  if (!previous || previous.status !== next.status) return false;
  if (previous.status === 'loading') return true;
  if (previous.status === 'error') {
    return next.status === 'error' && previous.isOffline === next.isOffline && previous.retry === next.retry;
  }
  if (next.status !== 'ready') return false;
  return (
    previous.count === next.count &&
    previous.rows.length === next.rows.length &&
    previous.rows.every((row, index) => sameRow(row, next.rows[index]))
  );
}

/** The footer's counts; `null` leaves a part out (its gate is off, or the count is unknown). */
export interface NeedsYouFooterCounts {
  aiHandled: number | null;
  needTechnician: number | null;
  newIncidents: number | null;
}

/** "3 tickets handled by AI · 2 need a technician · 4 new incidents", or null with nothing to say. */
export function needsYouFooter({ aiHandled, needTechnician, newIncidents }: NeedsYouFooterCounts): string | null {
  const parts: string[] = [];
  if (aiHandled !== null) parts.push(`${pluralize(aiHandled, 'ticket')} handled by AI`);
  if (needTechnician !== null) {
    parts.push(`${formatCount(needTechnician)} ${needTechnician === 1 ? 'needs' : 'need'} a technician`);
  }
  if (newIncidents !== null) parts.push(pluralize(newIncidents, 'new incident'));
  return parts.length > 0 ? parts.join(' · ') : null;
}

const joinDetail = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * A pending approval request — a `TICKET_` / `MINGO_APPROVAL_REQUEST` notification still
 * waiting for a decision, as the notifications drawer lists it. Opens where the request is
 * decided: its ticket, else its Mingo chat (the drawer's own route mapping).
 */
export function approvalRow(notification: Notification): NeedsYouRow | null {
  const approval = getApprovalMeta(notification);
  if (!approval || isApprovalResolved(approval.resolution)) return null;
  const href = resolveNotificationRoute(notification);
  if (!href) return null;

  const tools = approval.toolCalls.map(call => call.toolTitle || call.toolName).filter(Boolean);
  return {
    key: `approval:${approval.approvalRequestId}`,
    entity: 'approval',
    name: textOf(notification.title) || 'Approval required',
    detail: textOf(notification.description) || tools.join(' · '),
    reason: 'Needs approval',
    tone: 'warning',
    href,
    subjects: approval.ticketId
      ? [`approval:${approval.approvalRequestId}`, `ticket:${approval.ticketId}`]
      : [`approval:${approval.approvalRequestId}`],
  };
}

/** A NEW incident of CRITICAL severity. */
export function criticalIncidentRow(incident: IncidentRow): NeedsYouRow {
  return {
    key: `incident:${incident.id}`,
    entity: 'incident',
    name: incident.title,
    detail: joinDetail(incident.deviceName, incident.organizationName),
    reason: 'Critical',
    tone: 'error',
    href: routes.incidents.details(incident.id),
    subjects: [`insight:${incident.id}`],
  };
}

/**
 * A device whose disk is running out (the `DISK_SPACE_LOW` detector). The row is the
 * device, so it opens the device; a machine that no longer resolves has no page, and
 * the finding itself opens instead.
 */
export function diskWarningRow(incident: IncidentRow): NeedsYouRow {
  return {
    key: `disk:${incident.id}`,
    entity: 'device',
    deviceType: incident.deviceType,
    name: incident.deviceName,
    detail: joinDetail(incident.title, incident.organizationName),
    reason: 'Low disk space',
    tone: 'warning',
    href: incident.hasDevice ? routes.devices.details(incident.machineId) : routes.incidents.details(incident.id),
    subjects: [`insight:${incident.id}`],
  };
}

/** A Tech Required ticket the end user escalated to a person. */
export function escalatedTicketRow(ticket: Dialog): NeedsYouRow {
  return {
    key: `ticket:${ticket.id}`,
    entity: 'ticket',
    name: formatTicketRef(ticket, ticket.id),
    detail: joinDetail(ticket.organizationName, getTicketDeviceName(ticket)),
    reason: 'Escalated by user',
    tone: 'error',
    href: routes.tickets.dialog(ticket.id),
    subjects: [`ticket:${ticket.id}`],
  };
}

/** A cloud tenant (directory connection) whose last sync failed. */
export function failedSyncTenantRow(tenant: {
  id: string;
  name: string;
  provider: string;
  customerName: string;
}): NeedsYouRow {
  return {
    key: `tenant:${tenant.id}`,
    entity: 'tenant',
    name: tenant.name,
    detail: joinDetail(providerMark(tenant.provider).label, tenant.customerName),
    reason: 'Sync failed',
    tone: 'error',
    href: routes.cloudTenantManagement.details(tenant.id),
    subjects: [`tenant:${tenant.id}`],
  };
}

/** A software install / update run that FAILED. */
export function failedSoftwareActionRow(action: {
  id: string;
  software: string;
  action: string;
  engine: string;
  respondedMachineCount: number;
  totalMachineCount: number;
}): NeedsYouRow {
  const verb = softwareActionCopy(action.action)?.verb;
  return {
    key: `software:${action.id}`,
    entity: 'software',
    name: verb ? `${verb} ${action.software}` : action.software,
    detail: joinDetail(
      packageManagerLabel(action.engine),
      `${formatCount(action.respondedMachineCount)} / ${pluralize(action.totalMachineCount, 'device')}`,
    ),
    reason: 'Failed',
    tone: 'error',
    href: routes.software.action(action.id),
    subjects: [`software:${action.id}`],
  };
}
