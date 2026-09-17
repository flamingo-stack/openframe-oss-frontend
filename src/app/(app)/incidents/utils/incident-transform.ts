import type { QueryResultRow } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { readInlineData } from 'react-relay';
import type { insightFields_insight$key } from '@/__generated__/insightFields_insight.graphql';
import type {
  insightRowFields_insight$data,
  insightRowFields_insight$key,
} from '@/__generated__/insightRowFields_insight.graphql';
import type { insightUserFields_user$key } from '@/__generated__/insightUserFields_user.graphql';
import { DELETED_EMPLOYEE_LABEL, isDeletedUserStatus } from '@/app/components/shared/deleted-user';
import { insightFieldsFragment } from '@/graphql/insights/insight-fields';
import { insightRowFieldsFragment } from '@/graphql/insights/insight-row-fields';
import { insightUserFieldsFragment } from '@/graphql/insights/insight-user-fields';
import { getFullImageUrl } from '@/lib/image-url';
import { getDeviceName } from '../../devices/utils/device-name';

/**
 * A row of the Incidents table. The enum fields keep the artifact's own union
 * (which includes Relay's `"%future added value"`): a status this build does
 * not know still renders as a row — with its raw value and no actions — instead
 * of being dropped or mislabelled.
 */
export interface IncidentRow {
  id: string;
  title: string;
  type: insightRowFields_insight$data['type'];
  severity: insightRowFields_insight$data['severity'];
  status: insightRowFields_insight$data['status'];
  snoozedUntil: string | null;
  detectedAt: string;
  /** Raw `Machine.machineId` — the value the filter inputs and the device route take. */
  machineId: string;
  /** False when no `Machine` record resolved for `machineId` (a seed or a retired device) — nothing to link to. */
  hasDevice: boolean;
  deviceName: string;
  deviceType: string | null;
  /** Raw `Organization.organizationId` — what the customer route and filters take. */
  organizationId: string;
  organizationName: string;
}

export function toIncidentRow(ref: insightRowFields_insight$key): IncidentRow {
  const node = readInlineData(insightRowFieldsFragment, ref);
  const machine = node.machine;
  return {
    id: node.id,
    title: node.title,
    type: node.type,
    severity: node.severity,
    status: node.status,
    snoozedUntil: node.snoozedUntil ?? null,
    detectedAt: node.detectedAt,
    machineId: node.machineId,
    hasDevice: machine !== null && machine !== undefined,
    deviceName: getDeviceName(machine) || node.machineId,
    deviceType: machine?.type ?? null,
    organizationId: node.organizationId,
    organizationName: node.organization?.name ?? '',
  };
}

/** A `User` a record points at, as the page draws it. */
export interface IncidentUser {
  /** Raw `User.id` — what `assignInsight` and the note ownership check compare against. */
  id: string;
  name: string;
  avatarUrl?: string;
  /** DELETED / SELF_DELETED account, or one that no longer resolves at all. */
  deleted: boolean;
}

/**
 * `rawId` is the flat id the parent record carries (`assigneeId`, `authorId`)
 * — the `User` node's own `id` is an opaque handle, not the value the
 * mutations and the auth store speak. A null `ref` is a user the loader could
 * not resolve any more: shown as deleted rather than as an opaque id.
 */
export function toIncidentUser(rawId: string, ref: insightUserFields_user$key | null | undefined): IncidentUser {
  if (!ref) return { id: rawId, name: DELETED_EMPLOYEE_LABEL, deleted: true };
  const user = readInlineData(insightUserFieldsFragment, ref);
  return {
    id: rawId,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || rawId,
    avatarUrl: getFullImageUrl(user.image?.imageUrl, user.image?.hash),
    deleted: isDeletedUserStatus(user.status),
  };
}

/** The detail page's incident: the row plus what only it draws. */
export interface Incident extends IncidentRow {
  description: string | null;
  /** How often the detecting query runs, in seconds. */
  interval: number | null;
  /** The osquery evidence rows; null for incidents recorded before evidence was kept. */
  queryResult: QueryResultRow[] | null;
  assignee: IncidentUser | null;
  organizationImageUrl?: string;
}

/**
 * `queryResult` is `[JSON!]`: each row's keys are the detecting query's column
 * names. The report table takes string/number/null cells, so anything nested
 * is shown as its JSON text rather than `[object Object]`.
 */
function toQueryResultRow(row: unknown): QueryResultRow {
  if (row === null || typeof row !== 'object') return { value: String(row) };
  const out: QueryResultRow = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    out[key] = value === null || typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value);
  }
  return out;
}

export function toIncident(ref: insightFields_insight$key): Incident {
  const node = readInlineData(insightFieldsFragment, ref);
  return {
    ...toIncidentRow(node),
    description: node.description ?? null,
    interval: node.interval ?? null,
    queryResult: node.queryResult ? node.queryResult.map(toQueryResultRow) : null,
    assignee: node.assigneeId ? toIncidentUser(node.assigneeId, node.assignee) : null,
    organizationImageUrl: getFullImageUrl(node.organization?.image?.imageUrl, node.organization?.image?.hash),
  };
}
