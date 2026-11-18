'use client';

import { PenEditIcon, Refresh01LeftIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  type ActionsMenuItem,
  type ColumnDef,
  type Row,
  Switch,
  TruncateText,
  useDataTable,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { LiveTable } from '@/app/components/shared/live-table';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { formatInterval } from '../../utils/format-interval';
import { formatThreshold, INSIGHT_CHECK_PLATFORM_LABELS } from '../../utils/incident-check-labels';
import type { CheckScope, IncidentCheck } from '../../utils/incident-check-transform';
import { INCIDENT_SEVERITY_LABELS, labelOf } from '../../utils/incident-labels';
import { IncidentSeverityTag } from '../incident-tags';
import { settingSummary } from './check-source';
import { CHECK_COLUMNS } from './check-table-columns';

/** The built-in catalog's size: the rows the table holds while it loads. */
export const CHECKS_SKELETON_ROWS = 15;

/** What a row does, for an admin or owner; a reader's rows have none. */
interface CheckRowActions {
  busy: boolean;
  toggle: (enabled: boolean) => void;
  edit: () => void;
  reset: () => void;
}

/**
 * A row and everything its cells draw. It rides IN the row data, not in the column closures: the table
 * memoizes a row on its object, so a cell reading the columns' closure would keep what it saw first.
 * `check` is absent on a loading row, whose cells draw their loading forms.
 */
export interface CheckTableRow {
  id: string;
  check?: IncidentCheck;
  scope?: CheckScope;
  actions?: CheckRowActions | null;
}

function CheckCell({ check }: { check?: IncidentCheck }) {
  const platform = check ? labelOf(INSIGHT_CHECK_PLATFORM_LABELS, check.platform) : '';
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText>{check?.name ?? ''}</TruncateText>
      {/* The Threshold column is hidden below md; its value moves under the name. */}
      <div className="hidden min-w-0 content-md:block">
        <TruncateText variant="h6" tone="secondary">
          {check ? `${platform} · Every ${formatInterval(check.intervalSeconds)}` : ''}
        </TruncateText>
      </div>
      <div className="min-w-0 content-md:hidden">
        <TruncateText variant="h6" tone="secondary">
          {check ? [platform, ...thresholdValues(check)].join(' · ') : ''}
        </TruncateText>
      </div>
    </div>
  );
}

function thresholdValues(check: IncidentCheck): string[] {
  return check.parameters.map(parameter => formatThreshold(parameter.value, parameter.unit, parameter.firesWhen));
}

function SeverityCell({ check }: { check?: IncidentCheck }) {
  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-[var(--spacing-system-xxs)]">
      <IncidentSeverityTag severity={check?.severity} />
      {check?.escalatedSeverity && (
        <TruncateText variant="h6" tone="secondary">
          {`Up to ${labelOf(INCIDENT_SEVERITY_LABELS, check.escalatedSeverity)}`}
        </TruncateText>
      )}
    </div>
  );
}

function ThresholdCell({ check }: { check?: IncidentCheck }) {
  if (check && check.parameters.length === 0) {
    return (
      <TruncateText variant="h6" tone="secondary">
        No threshold
      </TruncateText>
    );
  }
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText>{check ? thresholdValues(check).join(' · ') : ''}</TruncateText>
      <TruncateText variant="h6" tone="secondary">
        {check ? check.parameters.map(parameter => parameter.label).join(' · ') : ''}
      </TruncateText>
    </div>
  );
}

function SettingCell({ check, scope }: { check?: IncidentCheck; scope?: CheckScope }) {
  const summary = check && scope ? settingSummary(check, scope) : null;
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText>{summary?.value ?? ''}</TruncateText>
      {(!summary || summary.detail) && (
        <TruncateText variant="h6" tone="secondary">
          {summary?.detail ?? ''}
        </TruncateText>
      )}
    </div>
  );
}

function StatusCell({ check, actions }: { check?: IncidentCheck; actions?: CheckRowActions | null }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <Switch
        checked={check?.enabled ?? false}
        onCheckedChange={enabled => actions?.toggle(enabled)}
        disabled={!check || !actions || actions.busy}
        aria-label={check ? `Run ${check.name}` : 'Loading check'}
      />
      {/* Below md the switch alone: the name gets the room. */}
      <div className="hidden min-w-0 content-md:block">
        <TruncateText variant="h6">{check ? (check.enabled ? 'On' : 'Off') : ''}</TruncateText>
      </div>
    </div>
  );
}

function ActionsCell({ check, actions }: { check?: IncidentCheck; actions?: CheckRowActions | null }) {
  if (!check || !actions) return null;
  const items: ActionsMenuItem[] = [
    {
      id: 'edit',
      label: 'Edit',
      icon: <PenEditIcon className="size-6 text-ods-text-secondary" />,
      disabled: actions.busy,
      onClick: actions.edit,
    },
  ];
  if (check.customized) {
    items.push({
      id: 'reset',
      label: 'Reset to inherited',
      icon: <Refresh01LeftIcon className="size-6 text-ods-text-secondary" />,
      disabled: actions.busy,
      onClick: actions.reset,
    });
  }
  return (
    <div data-no-row-click className="pointer-events-auto flex items-center justify-end">
      <ActionsMenuDropdown groups={[{ items }]} />
    </div>
  );
}

type CellProps = { row: Row<CheckTableRow> };

const CHECK_TABLE_COLUMNS: ColumnDef<CheckTableRow>[] = [
  {
    id: CHECK_COLUMNS.check.id,
    header: CHECK_COLUMNS.check.header,
    cell: ({ row }: CellProps) => <CheckCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.check),
  },
  {
    id: CHECK_COLUMNS.severity.id,
    header: CHECK_COLUMNS.severity.header,
    cell: ({ row }: CellProps) => <SeverityCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.severity),
  },
  {
    id: CHECK_COLUMNS.threshold.id,
    header: CHECK_COLUMNS.threshold.header,
    cell: ({ row }: CellProps) => <ThresholdCell check={row.original.check} />,
    meta: liveColumnMeta(CHECK_COLUMNS.threshold),
  },
  {
    id: CHECK_COLUMNS.setting.id,
    header: CHECK_COLUMNS.setting.header,
    cell: ({ row }: CellProps) => <SettingCell check={row.original.check} scope={row.original.scope} />,
    meta: liveColumnMeta(CHECK_COLUMNS.setting),
  },
  {
    id: CHECK_COLUMNS.status.id,
    header: CHECK_COLUMNS.status.header,
    cell: ({ row }: CellProps) => <StatusCell check={row.original.check} actions={row.original.actions} />,
    meta: liveColumnMeta(CHECK_COLUMNS.status),
  },
  {
    id: CHECK_COLUMNS.actions.id,
    cell: ({ row }: CellProps) => <ActionsCell check={row.original.check} actions={row.original.actions} />,
    meta: liveColumnMeta(CHECK_COLUMNS.actions),
  },
];

/**
 * Every check at one scope as the incident lists draw their rows; a click opens its edit form. In a loading
 * scope (or before its rows) it is the same columns over placeholder rows.
 */
export function CheckTable({ rows }: { rows?: CheckTableRow[] }) {
  if (useLoadingScope() || !rows) {
    return <LiveTable columns={CHECK_TABLE_COLUMNS} skeletonRows={CHECKS_SKELETON_ROWS} itemName="check" />;
  }
  return <CheckTableLive rows={rows} />;
}

function CheckTableLive({ rows }: { rows: CheckTableRow[] }) {
  const table = useDataTable<CheckTableRow>({
    data: rows,
    columns: CHECK_TABLE_COLUMNS,
    getRowId: (row: CheckTableRow) => row.id,
    enableSorting: false,
  });
  return (
    <LiveTable
      table={table}
      skeletonRows={CHECKS_SKELETON_ROWS}
      itemName="check"
      onRowClick={(row: CheckTableRow) => row.actions?.edit()}
    />
  );
}
