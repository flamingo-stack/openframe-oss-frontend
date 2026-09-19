'use client';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type PageActionButton,
  PageLayout,
  RadioGroupBlock,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { getDevicePrimaryId } from '@/app/(app)/scripts/shared/utils/device-helpers';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { ScheduleTimeReference, type SoftwareAction } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { PACKAGE_MANAGER_OS } from '../shared/package-managers';
import { SOFTWARE_ACTION_COPY } from '../shared/software-action-copy';
import { ScheduleFields } from './schedule-fields';
import { newSoftwareRow, type SoftwareRow } from './software-row';
import { SoftwareRowFields } from './software-row-fields';
import { type RunMode, useSoftwareActionSubmit } from './use-software-action-submit';

function agentMissing(device: Device): string | undefined {
  return device.machineId ? undefined : 'Agent is not\nconnected';
}

/**
 * Install Software (design 258:24314) and Update Software (409:48080 / 409:48175):
 * which catalog packages, now or on a schedule, on which devices. One page for
 * both flows; `useSoftwareActionSubmit` owns what each one sends.
 */
export function SoftwareActionView({ action }: { action: SoftwareAction }) {
  const copy = SOFTWARE_ACTION_COPY[action];
  const handleBack = useSafeBack(routes.software.actions);
  const { submit, isSubmitting } = useSoftwareActionSubmit(action);

  const [rows, setRows] = useState<SoftwareRow[]>(() => [newSoftwareRow('row-0')]);
  const [mode, setMode] = useState<RunMode>('now');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [timeReference, setTimeReference] = useState<ScheduleTimeReference>(ScheduleTimeReference.SERVER);
  const [selection, setSelection] = useState<Device[]>([]);

  const osTypes = [...new Set(rows.map(row => PACKAGE_MANAGER_OS[row.packageManager]))];
  const deviceFilter: DeviceFilterInput = { statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE], osTypes };

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    {
      label: mode === 'now' ? copy.runLabel : copy.scheduleLabel,
      variant: 'accent',
      onClick: () => submit({ rows, selection, mode, date, time, timeReference }),
      disabled: selection.length === 0,
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

      <DeviceListPicker
        filter={deviceFilter}
        selected={selection}
        onSelectionChange={setSelection}
        getDeviceKey={getDevicePrimaryId}
        isDeviceDisabled={agentMissing}
      />
    </PageLayout>
  );
}
