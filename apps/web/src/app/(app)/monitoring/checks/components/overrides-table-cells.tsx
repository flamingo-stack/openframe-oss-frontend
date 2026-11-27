'use client';

import {
  ArrowRightUpIcon,
  BuildingIcon,
  MonitorIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ActionsMenuItem, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { InsightCheckScopeType } from '@/generated/schema-enums';
import { formatOverrideThreshold } from '../utils/check-labels';
import type { Check, CheckOverride } from '../utils/check-transform';
import type { OverrideDevicesTarget, OverrideRowActions } from './overrides-table-row';
import { RowMenuCell } from './row-menu-cell';

function ScopeIcon({ type }: { type: string }) {
  const className = 'size-5 shrink-0 text-ods-text-secondary';
  if (type === InsightCheckScopeType.DEVICE) return <MonitorIcon className={className} />;
  if (type === InsightCheckScopeType.TAG) return <TagIcon className={className} />;
  return <BuildingIcon className={className} />;
}

export function AppliesToCell({ override }: { override: CheckOverride }) {
  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
      <ScopeIcon type={override.scopeType} />
      <TruncateText>{override.name ?? 'Removed'}</TruncateText>
    </div>
  );
}

export function ThresholdCell({ check, override }: { check: Check; override: CheckOverride }) {
  return <TruncateText>{formatOverrideThreshold(check, override)}</TruncateText>;
}

/** How many devices the exception covers; the row's menu opens them. */
export function DevicesCell({ count }: { count: number }) {
  return <TruncateText>{String(count)}</TruncateText>;
}

export function ActionsCell({
  actions,
  devices,
  grid = false,
}: {
  actions: OverrideRowActions | null;
  devices: OverrideDevicesTarget | null;
  grid?: boolean;
}) {
  if (!actions) return null;
  const items: ActionsMenuItem[] = [{ id: 'edit', label: 'Edit', disabled: actions.busy, onClick: actions.edit }];
  if (devices) {
    items.push({
      id: 'open',
      label: devices.label,
      href: devices.href,
      iconAction: {
        icon: <ArrowRightUpIcon className="size-5" />,
        'aria-label': `${devices.label} in new tab`,
        href: devices.href,
        openInNewTab: true,
      },
    });
  }
  return (
    <RowMenuCell
      grid={grid}
      groups={[
        { items },
        { items: [{ id: 'delete', label: 'Delete', disabled: actions.busy, onClick: actions.delete }] },
      ]}
    />
  );
}
