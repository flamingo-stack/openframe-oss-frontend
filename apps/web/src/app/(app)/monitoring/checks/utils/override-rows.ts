import { InsightCheckScopeType } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import type { CheckDialog } from '../components/check-dialogs';
import type { OverrideDevicesTarget, OverrideTableRow } from '../components/overrides-table-row';
import type { Check, CheckOverride } from './check-transform';

/** Where an exception's devices are: the customer's devices, or the device itself. A tag has nowhere to go yet. */
function devicesTarget(override: CheckOverride): OverrideDevicesTarget | null {
  if (override.scopeType === InsightCheckScopeType.CUSTOMER) {
    return { label: 'Open Devices', href: routes.devices.filtered({ organizationIds: [override.scopeId] }) };
  }
  if (override.scopeType === InsightCheckScopeType.DEVICE) {
    return { label: 'Open Device', href: routes.devices.details(override.scopeId) };
  }
  return null;
}

/** The exceptions table's rows: each exception with where its devices are and, for an admin, its edit and delete. */
export function overrideRows(
  check: Check,
  overrides: readonly CheckOverride[],
  editable: boolean,
  openDialog: (dialog: CheckDialog) => void,
): OverrideTableRow[] {
  return overrides.map(override => ({
    id: override.id,
    check,
    override,
    devices: devicesTarget(override),
    actions: editable
      ? {
          busy: false,
          edit: () => openDialog({ kind: 'override', editing: override }),
          delete: () => openDialog({ kind: 'delete-override', override }),
        }
      : null,
  }));
}
