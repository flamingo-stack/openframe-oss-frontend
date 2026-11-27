'use client';

import { Switch, TruncateText, type ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { INCIDENT_SEVERITY_LABELS, labelOf } from '@/app/(app)/incidents/utils/incident-labels';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDefaultThreshold } from '../utils/check-labels';
import type { Check } from '../utils/check-transform';
import type { CheckRowActions, CheckTableRow } from './checks-table-row';
import { RowMenuCell } from './row-menu-cell';

export function CheckCell({ check }: { check?: Check }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <TruncateText>{check?.name ?? ''}</TruncateText>
      {/* Severity and Threshold are hidden below md; their values move under the name. */}
      <div className="min-w-0 content-md:hidden">
        <TruncateText variant="h6" tone="secondary">
          {check ? `${labelOf(INCIDENT_SEVERITY_LABELS, check.severity)} · ${formatDefaultThreshold(check)}` : ''}
        </TruncateText>
      </div>
    </div>
  );
}

export function SeverityCell({ check }: { check?: Check }) {
  // A column flexbox: `items-start` keeps the tag at its own width, as in the incident lists.
  return (
    <div className="flex min-w-0 flex-col items-start justify-center">
      <IncidentSeverityTag severity={check?.severity} />
    </div>
  );
}

/** The default for every device: "Below 10%", "On / off". */
export function ThresholdCell({ check }: { check?: Check }) {
  return <TruncateText>{check ? formatDefaultThreshold(check) : ''}</TruncateText>;
}

/** How many exceptions change the default; the empty mark when none does. */
export function ExceptionsCell({ check }: { check?: Check }) {
  if (!check) return <TruncateText>{''}</TruncateText>;
  return <TruncateText>{check.overrideCount > 0 ? String(check.overrideCount) : EMPTY_VALUE}</TruncateText>;
}

export function EnabledCell({ check, actions }: { check?: Check; actions?: CheckRowActions | null }) {
  return (
    <div data-no-row-click className="pointer-events-auto flex min-w-0 items-center">
      <Switch
        checked={check?.enabled ?? false}
        onCheckedChange={enabled => actions?.toggle(enabled)}
        disabled={!check || !actions || actions.busy}
        aria-label={check ? `${check.name} for all devices` : 'Loading check'}
      />
    </div>
  );
}

export function ActionsCell({
  check,
  actions,
  grid = false,
}: {
  check?: Check;
  actions?: CheckRowActions | null;
  grid?: boolean;
}) {
  if (!check || !actions) return null;
  const items: ActionsMenuItem[] = [];
  // An on/off check has no default threshold to edit: its default is the switch.
  if (check.parameters.length > 0) {
    items.push({
      id: 'edit-default',
      label: 'Edit Default',
      disabled: actions.busy,
      onClick: actions.editDefault,
    });
  }
  items.push({
    id: 'add-exception',
    label: 'Add Exception',
    disabled: actions.busy,
    onClick: actions.addOverride,
  });
  return <RowMenuCell groups={[{ items }]} grid={grid} />;
}

/** The row's ↗: the check's page. Bare in the grid's action column, outlined in card rows. */
export function OpenCell({ row, grid = false }: { row: CheckTableRow; grid?: boolean }) {
  return (
    <OpenRowButton
      grid={grid}
      label={row.check ? `Open ${row.check.name}` : 'Open check'}
      onClick={() => row.open?.()}
      disabled={!row.open}
    />
  );
}
