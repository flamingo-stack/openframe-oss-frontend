'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type PageActionButton,
  PageLayout,
  RadioGroupBlock,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useMemo, useState } from 'react';
import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { ScheduleTimeReference, type SoftwareAction } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { PACKAGE_MANAGER_OS } from '../shared/package-managers';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { BundleDevicePicker } from './bundle-device-picker';
import { ScheduleFields } from './schedule-fields';
import { newSoftwareRow, type SoftwareRow } from './software-row';
import { SoftwareRowFields } from './software-row-fields';
import { useDraftBundle } from './use-draft-bundle';
import { type RunMode, useSoftwareActionSubmit } from './use-software-action-submit';

function agentMissing(device: Device): string | undefined {
  return device.machineId ? undefined : 'Agent is not\nconnected';
}

/**
 * Install Software (design 591:8524) and Update Software (409:48080 / 409:48175):
 * which catalog packages, now or on a schedule, on which devices. One page for
 * both flows.
 *
 * The packages and the timing are form state; the devices are not. They live on
 * a draft bundle the first assignment opens (`useDraftBundle`) and every later
 * one edits in place, so the selection is never held in the browser — and
 * submit sends the bundle's id, not a list (`useSoftwareActionSubmit`).
 */
export function SoftwareActionView({ action }: { action: SoftwareAction }) {
  const copy = SOFTWARE_ACTION_COPY[action];
  const handleBack = useSafeBack(routes.software.actions);
  const { bundleId, deviceCount, ensureBundle, markSubmitted } = useDraftBundle();
  const { submit, isSubmitting } = useSoftwareActionSubmit(action, { onSubmitted: markSubmitted });

  const [rows, setRows] = useState<SoftwareRow[]>(() => [newSoftwareRow('row-0')]);
  const [mode, setMode] = useState<RunMode>('now');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [timeReference, setTimeReference] = useState<ScheduleTimeReference>(ScheduleTimeReference.SERVER);

  // The picker's frame: live devices on the OS the chosen packages install on.
  // Keyed by the OS list's text so a re-render with the same rows keeps the
  // same object — the picker's queries and facets are keyed by it.
  const osTypesKey = [...new Set(rows.map(row => PACKAGE_MANAGER_OS[row.packageManager]))].sort().join(',');
  const scope = useMemo<DeviceFilterInput>(
    () => ({ statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE], osTypes: osTypesKey.split(',') }),
    [osTypesKey],
  );

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    {
      label: mode === 'now' ? copy.runLabel : copy.scheduleLabel,
      variant: 'accent',
      onClick: () => submit({ rows, bundleId, deviceCount, mode, date, time, timeReference }),
      disabled: deviceCount === 0,
      loading: isSubmitting,
    },
  ];

  const updateRow = (next: SoftwareRow) => setRows(current => current.map(row => (row.key === next.key ? next : row)));
  const removeRow = (key: string) => setRows(current => current.filter(row => row.key !== key));
  const addRow = () => setRows(current => [...current, newSoftwareRow(crypto.randomUUID())]);

  return (
    <PageLayout
      title={copy.formTitle}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {rows.map(row => (
        <SoftwareRowFields
          key={row.key}
          row={row}
          removable={rows.length > 1}
          onChange={updateRow}
          onRemove={() => removeRow(row.key)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="small"
        className="self-start"
        onClick={addRow}
        leftIcon={<PlusCircleIcon size={24} className="text-ods-text-primary" />}
      >
        Add Software
      </Button>

      <RadioGroupBlock
        name="runMode"
        variant="grouped"
        value={mode}
        onValueChange={value => setMode(value as RunMode)}
        options={copy.modes}
        itemClassName="py-[var(--spacing-system-sf)]"
      />

      {mode === 'schedule' && (
        <ScheduleFields
          date={date}
          time={time}
          timeReference={timeReference}
          onDateChange={setDate}
          onTimeChange={setTime}
          onTimeReferenceChange={setTimeReference}
        />
      )}

      <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">Device Selection</h2>

      <BundleDevicePicker
        bundleId={bundleId}
        ensureBundle={ensureBundle}
        scope={scope}
        isDeviceDisabled={agentMissing}
      />
    </PageLayout>
  );
}
