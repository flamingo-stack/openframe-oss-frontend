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
import { untitledRequestName } from '@/app/components/approvals/approval-inbox';
import { resolveNotificationRoute } from '@/app/components/notifications/notification-navigation';
import { isApprovalResolved } from '@/graphql/notifications/notification-attributes';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { formatCount } from '@/lib/format-number';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';

/**
 * "Needs you" on Mingo's home and the dashboard: a queue of what waits for a person, composed
 * on the client from six existing contracts (FE_PROMPT §3.2, §12.2) — there is no combined
 * feed — over one quick action per category. This module is the block's logic as plain data:
 * what each row says and when it started needing someone, the queue's order, the counts, and
 * when the block loads, hides or reports a failure.
 */

/** The sources, one read each. */
export const NEEDS_YOU_SOURCES = ['approvals', 'incidents', 'tickets', 'tenants', 'software', 'disk'] as const;
export type NeedsYouSource = (typeof NEEDS_YOU_SOURCES)[number];

/** The quick actions under the queue, in the order they are drawn. */
export const NEEDS_YOU_CATEGORIES = ['incidents', 'approvals', 'tickets', 'tenants', 'software', 'devices'] as const;
export type NeedsYouCategory = (typeof NEEDS_YOU_CATEGORIES)[number];

/** The category a source's rows and count belong to. */
export const NEEDS_YOU_SOURCE_CATEGORY = {
  approvals: 'approvals',
  incidents: 'incidents',
  tickets: 'tickets',
  tenants: 'tenants',
  software: 'software',
  disk: 'devices',
} as const satisfies Record<NeedsYouSource, NeedsYouCategory>;

/** The rows the queue shows, loading or loaded: the block is this many rows high, whatever it holds. */
export const NEEDS_YOU_ROWS = 3;

/**
 * How many candidates each source reads: enough to fill the queue on its own after the rows the
 * user dismissed and the ones another source already lists.
 */
export const NEEDS_YOU_CANDIDATES = 5;

/** What a row is about — it picks the row's icon. */
export type NeedsYouEntity = 'approval' | 'incident' | 'ticket' | 'tenant' | 'software' | 'device';

/** The status tag's look: `critical` red filled, `warning` the attention tint, `neutral` grey. */
export type NeedsYouTone = 'critical' | 'warning' | 'neutral';

export interface NeedsYouRow {
  /** Unique on the card. */
  key: string;
  entity: NeedsYouEntity;
  /** The device's type, for a `device` row's icon. */
  deviceType?: string | null;
  name: string;
  /** What else the row knows about the item (customer, device…): told to Mingo, not drawn. */
  detail: string;
  /** The status tag: why it needs a person. */
  reason: string;
  tone: NeedsYouTone;
  /** The entity's page. */
  href: string;
  /**
   * When the item started needing a person, in epoch ms (0 when unknown): the queue is newest
   * first, and a dismissal hides the item only up to this time.
   */
  at: number;
  /**
   * The things this row stands for (`ticket:<id>`, `insight:<id>`). A thing already in the
   * queue is not listed twice: the older row naming it is skipped.
   */
  subjects: readonly string[];
}

/** What a source has said so far. */
export type SourceReport =
  | { status: 'loading' }
  | {
      status: 'ready';
      /** The candidates the source read. */
      rows: readonly NeedsYouRow[];
      /** The category's count; the rows read when the source has no count of its own. */
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

/** A quick action: the category's count, or its failure. */
export interface NeedsYouCategoryCount {
  category: NeedsYouCategory;
  /** `null` when the category's source failed. */
  count: number | null;
  /** The category's failed sources (empty when it loaded). */
  failures: NeedsYouFailure[];
}

/** Rows the user dismissed: the row's key and when, in epoch ms. */
export type NeedsYouDismissed = Readonly<Record<string, number>>;

export type NeedsYouView =
  | { status: 'loading' }
  /** No source is open (every gate is off): the block has nothing to say. */
  | { status: 'hidden' }
  | {
      status: 'ready';
      /** Every row still needing the user, newest first; the block shows the first `NEEDS_YOU_ROWS`. */
      queue: NeedsYouRow[];
      /** One per category that has an open source, in `NEEDS_YOU_CATEGORIES` order. */
      categories: NeedsYouCategoryCount[];
      failures: NeedsYouFailure[];
    };

/** Whether the user dismissed this row after it last started needing them. */
export function isDismissed(row: NeedsYouRow, dismissed: NeedsYouDismissed): boolean {
  const at = dismissed[row.key];
  return at !== undefined && row.at <= at;
}

/**
 * The block from what the sources said.
 *
 * - **Loading** while any gate is unanswered, any source behind an open gate has not
 *   answered, or `pending` (a count still being read) holds. Early rows are not shown ahead of
 *   the rest: a newer row landing later would push them down.
 * - **Ready** once everything answered: every row, newest first, without the ones the user
 *   dismissed and without an older row about a thing a newer one already lists; and one count
 *   per category with an open source. A source that FAILED is a failure, and its category's
 *   count is `null`.
 * - **Hidden** only when every gate is off.
 * - A source behind a gate that is off contributes nothing and is not waited for.
 */
export function resolveNeedsYou(
  gates: NeedsYouGates,
  reports: NeedsYouReports,
  { pending = false, dismissed = {} }: { pending?: boolean; dismissed?: NeedsYouDismissed } = {},
): NeedsYouView {
  let loading = pending;
  const candidates: NeedsYouRow[] = [];
  const failures: NeedsYouFailure[] = [];
  const counts = new Map<NeedsYouCategory, NeedsYouCategoryCount>();

  for (const source of NEEDS_YOU_SOURCES) {
    const gate = gates[source];
    if (gate === 'off') continue;
    const category = NEEDS_YOU_SOURCE_CATEGORY[source];
    const entry = counts.get(category) ?? { category, count: 0, failures: [] };
    counts.set(category, entry);
    const report = reports[source];
    if (gate === 'loading' || !report || report.status === 'loading') {
      loading = true;
      continue;
    }
    if (report.status === 'error') {
      const failure = { source, isOffline: report.isOffline, retry: report.retry };
      failures.push(failure);
      entry.failures.push(failure);
      entry.count = null;
      continue;
    }
    if (entry.count !== null) entry.count += report.count ?? report.rows.length;
    candidates.push(...report.rows);
  }

  if (loading) return { status: 'loading' };
  if (counts.size === 0) return { status: 'hidden' };

  // Newest first; a tie keeps the sources' order (the sort is stable).
  candidates.sort((a, b) => b.at - a.at);
  const queue: NeedsYouRow[] = [];
  const listed = new Set<string>();
  for (const row of candidates) {
    if (row.subjects.some(subject => listed.has(subject))) continue;
    for (const subject of row.subjects) listed.add(subject);
    if (!isDismissed(row, dismissed)) queue.push(row);
  }

  const categories = NEEDS_YOU_CATEGORIES.flatMap(category => {
    const entry = counts.get(category);
    return entry ? [entry] : [];
  });
  return { status: 'ready', queue, categories, failures };
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
    a.at === b.at &&
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

/**
 * Where a quick action leads: its category's page, narrowed to what its count counts where the
 * page reads such a filter from its URL. The cloud tenants and devices lists have none for a
 * failed sync or a low disk, so they open whole.
 */
export function categoryHref(
  category: NeedsYouCategory,
  { techRequiredStatusIds }: { techRequiredStatusIds: readonly string[] },
): string {
  const href: Record<NeedsYouCategory, string> = {
    incidents: routes.incidents.filtered({ status: ['NEW'] }),
    approvals: routes.approvals,
    tickets:
      techRequiredStatusIds.length > 0
        ? routes.tickets.filtered({ status: techRequiredStatusIds })
        : routes.tickets.list,
    tenants: routes.cloudTenantManagement.list,
    software: routes.software.actionsFiltered({ status: ['FAILED'] }),
    devices: routes.devices.list,
  };
  return href[category];
}

/** An `Instant` / ISO string, or epoch ms, as epoch ms; 0 when missing or unreadable. */
export function epochOf(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

const joinDetail = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * A pending approval request — a `TICKET_` / `MINGO_APPROVAL_REQUEST` notification still
 * waiting for a decision, as the notifications drawer lists it. Opens where the request is
 * decided: its ticket, else its Mingo chat (the drawer's own route mapping).
 */
export function approvalRow(
  notification: Notification,
  chatTitles: Readonly<Record<string, string>> = {},
): NeedsYouRow | null {
  const approval = getApprovalMeta(notification);
  if (!approval || isApprovalResolved(approval.resolution)) return null;
  const href = resolveNotificationRoute(notification);
  if (!href) return null;

  const tools = approval.toolCalls.map(call => call.toolTitle || call.toolName).filter(Boolean);
  return {
    key: `approval:${approval.approvalRequestId}`,
    entity: 'approval',
    name: untitledRequestName(notification, chatTitles) || textOf(notification.title) || 'Approval required',
    detail: textOf(notification.description) || tools.join(' · '),
    reason: 'Needs approval',
    tone: 'warning',
    href,
    at: epochOf(notification.createdAt),
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
    tone: 'critical',
    href: routes.incidents.details(incident.id),
    at: epochOf(incident.detectedAt),
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
    reason: 'Low disk',
    tone: 'neutral',
    href: incident.hasDevice ? routes.devices.details(incident.machineId) : routes.incidents.details(incident.id),
    at: epochOf(incident.detectedAt),
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
    tone: 'warning',
    href: routes.tickets.dialog(ticket.id),
    // When it moved to Tech Required; a ticket whose move is not read, when it was opened.
    at: epochOf(ticket.statusUpdatedAt ?? ticket.createdAt),
    subjects: [`ticket:${ticket.id}`],
  };
}

/** A cloud tenant (directory connection) whose last sync failed. */
export function failedSyncTenantRow(tenant: {
  id: string;
  name: string;
  provider: string;
  customerName: string;
  lastSyncAt: string | null | undefined;
}): NeedsYouRow {
  return {
    key: `tenant:${tenant.id}`,
    entity: 'tenant',
    name: tenant.name,
    detail: joinDetail(providerMark(tenant.provider).label, tenant.customerName),
    reason: 'Sync failed',
    tone: 'neutral',
    href: routes.cloudTenantManagement.details(tenant.id),
    at: epochOf(tenant.lastSyncAt),
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
  finishedAt: string | null | undefined;
  dispatchedAt: string | null | undefined;
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
    reason: 'Action failed',
    tone: 'neutral',
    href: routes.software.action(action.id),
    at: epochOf(action.finishedAt ?? action.dispatchedAt),
    subjects: [`software:${action.id}`],
  };
}

const ENTITY_NOUN: Record<NeedsYouEntity, string> = {
  approval: 'Approval request',
  incident: 'Incident',
  ticket: 'Ticket',
  tenant: 'Cloud tenant',
  software: 'Software action',
  device: 'Device',
};

/** What the Mingo button sends: the item, why it needs the user, what else is known, and where it is. */
export function needsYouMingoPrompt(row: NeedsYouRow): string {
  const what = `${ENTITY_NOUN[row.entity]} "${row.name}" needs my attention (${row.reason.toLowerCase()}).`;
  return [what, row.detail && `Details: ${row.detail}.`, `Page: ${row.href}`, 'Help me resolve it.']
    .filter(Boolean)
    .join('\n');
}
