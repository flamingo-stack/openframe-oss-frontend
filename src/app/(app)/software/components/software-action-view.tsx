'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  DatePickerInputSimple,
  Label,
  type PageActionButton,
  RadioGroupBlock,
  type RadioGroupBlockOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useMutation } from 'react-relay';
import type { createSoftwareScheduleMutation as CreateScheduleMutationType } from '@/__generated__/createSoftwareScheduleMutation.graphql';
import type { installSoftwareMutation as InstallMutationType } from '@/__generated__/installSoftwareMutation.graphql';
import type { updateSoftwareMutation as UpdateMutationType } from '@/__generated__/updateSoftwareMutation.graphql';
import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { TIME_REFERENCE_OPTIONS } from '@/app/(app)/scripts/schedule/types/edit-schedule.types';
import {
  applyTimeSlot,
  earliestScheduleDay,
  getTimeSlotOptions,
  isScheduleStartInPast,
  PAST_START_MESSAGE,
  toScheduleInstant,
} from '@/app/(app)/scripts/schedule/utils/schedule-timing';
import { getDevicePrimaryId } from '@/app/(app)/scripts/shared/utils/device-helpers';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import {
  type BrewPackageType,
  PackageManagerType,
  ScheduleTimeReference,
  SoftwareAction,
} from '@/generated/schema-enums';
import { createSoftwareScheduleMutation } from '@/graphql/software/create-software-schedule-mutation';
import { installSoftwareMutation } from '@/graphql/software/install-software-mutation';
import { updateSoftwareMutation } from '@/graphql/software/update-software-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { PACKAGE_MANAGER_LABEL, PACKAGE_MANAGER_OS, PACKAGE_MANAGERS } from './package-managers';
import { PackageSearchField, PackageSearchFieldPlaceholder, type SelectedPackage } from './package-search-field';

type RunMode = 'now' | 'schedule';

interface ActionCopy {
  title: string;
  runLabel: string;
  scheduleLabel: string;
  modes: RadioGroupBlockOption[];
  started: string;
  scheduled: string;
  failed: string;
}

/** Everything the two flows word differently. The page itself is one. */
const COPY: Record<SoftwareAction, ActionCopy> = {
  INSTALL: {
    title: 'Install Software',
    runLabel: 'Run Installation',
    scheduleLabel: 'Schedule Install',
    modes: [
      { value: 'now', label: 'Install Now', description: 'The install starts immediately.' },
      {
        value: 'schedule',
        label: 'Schedule Install',
        description: 'The install runs automatically at the scheduled time.',
      },
    ],
    started: 'Installation started',
    scheduled: 'Installation scheduled',
    failed: 'Failed to start the installation',
  },
  UPDATE: {
    title: 'Update Software',
    runLabel: 'Run Update',
    scheduleLabel: 'Schedule Update',
    modes: [
      { value: 'now', label: 'Update Now', description: 'The update starts immediately.' },
      {
        value: 'schedule',
        label: 'Schedule Update',
        description: 'The update runs automatically at the scheduled time.',
      },
    ],
    started: 'Update started',
    scheduled: 'Update scheduled',
    failed: 'Failed to start the update',
  },
};

interface SoftwareRow {
  key: string;
  packageManager: PackageManagerType;
  pkg: SelectedPackage | null;
}

interface PackageInput {
  packageManager: PackageManagerType;
  packageName: string;
  brewPackageType: BrewPackageType | null;
}

function newRow(key: string): SoftwareRow {
  return { key, packageManager: PackageManagerType.BREW, pkg: null };
}

function hasMachineId(device: Device): boolean {
  return !!device.machineId;
}

/** Every row as the mutation's package input — null while any row is still empty. */
function toPackageInputs(rows: SoftwareRow[]): PackageInput[] | null {
  const packages = rows.flatMap(row =>
    row.pkg
      ? [
          {
            packageManager: row.packageManager,
            // The catalog id IS the name the package manager installs by.
            packageName: row.pkg.id,
            brewPackageType: row.packageManager === PackageManagerType.BREW ? row.pkg.packageType : null,
          },
        ]
      : [],
  );
  return packages.length === rows.length ? packages : null;
}

interface SoftwareRowFieldsProps {
  row: SoftwareRow;
  removable: boolean;
  onChange: (row: SoftwareRow) => void;
  onRemove: () => void;
}

function SoftwareRowFields({ row, removable, onChange, onRemove }: SoftwareRowFieldsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)] lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <Select
          value={row.packageManager}
          onValueChange={value => onChange({ ...row, packageManager: value as PackageManagerType, pkg: null })}
        >
          <SelectTrigger label="Package Manager">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACKAGE_MANAGERS.map(manager => (
              <SelectItem key={manager} value={manager}>
                {PACKAGE_MANAGER_LABEL[manager]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 flex-1">
        {/* Keyed by catalog: a new package manager starts a new search. */}
        <ErrorBoundary
          key={row.packageManager}
          fallback={<PackageSearchFieldPlaceholder error="Couldn't search packages." />}
        >
          <Suspense fallback={<PackageSearchFieldPlaceholder />}>
            <PackageSearchField
              packageManager={row.packageManager}
              value={row.pkg}
              onChange={pkg => onChange({ ...row, pkg })}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <InfoCell value={row.pkg?.description || '-'} label="Description" />

      <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-lf)]">
        <InfoCell value={row.pkg?.version || '-'} label="Current Version" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Remove software"
          onClick={onRemove}
          disabled={!removable}
          leftIcon={<TrashIcon size={24} className="text-ods-error" />}
        />
      </div>
    </div>
  );
}

interface ScheduleFieldsProps {
  date: Date | null;
  time: string;
  timeReference: ScheduleTimeReference;
  onDateChange: (date: Date | null) => void;
  onTimeChange: (time: string) => void;
  onTimeReferenceChange: (reference: ScheduleTimeReference) => void;
}

/** Date / Time / Timezone — the same grid and readings as a script schedule's start. */
function ScheduleFields({
  date,
  time,
  timeReference,
  onDateChange,
  onTimeChange,
  onTimeReferenceChange,
}: ScheduleFieldsProps) {
  const timeOptions = getTimeSlotOptions(date, timeReference);
  const inPast = isScheduleStartInPast(date, time, timeReference);

  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] md:grid-cols-4 md:items-start">
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Date</Label>
        <DatePickerInputSimple
          placeholder="Select date"
          value={date ?? undefined}
          onChange={next => onDateChange(next ?? null)}
          fromDate={earliestScheduleDay(timeReference)}
          className="w-full"
          error={inPast ? PAST_START_MESSAGE : undefined}
          invalid={inPast}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Time</Label>
        <Select value={time} onValueChange={onTimeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <Label className="text-h4">Timezone</Label>
        <Select value={timeReference} onValueChange={value => onTimeReferenceChange(value as ScheduleTimeReference)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_REFERENCE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Install Software (design 258:24314) and Update Software (409:48080 / 409:48175):
 * which catalog packages, now or on a schedule, on which devices. One page, two
 * mutations per mode — `installSoftware` / `updateSoftware` now,
 * `createSoftwareSchedule` with the matching `action` later.
 *
 * A run-now lands on the first package's execution history; a schedule has no
 * page of its own yet, so it returns to the list it was started from.
 */
export function SoftwareActionView({ action }: { action: SoftwareAction }) {
  const copy = COPY[action];
  const router = useRouter();
  const { toast } = useToast();
  const listRoute = action === SoftwareAction.UPDATE ? routes.software.updates : routes.software.list;
  const handleBack = useSafeBack(listRoute);

  const [rows, setRows] = useState<SoftwareRow[]>(() => [newRow('row-0')]);
  const [mode, setMode] = useState<RunMode>('now');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [timeReference, setTimeReference] = useState<ScheduleTimeReference>(ScheduleTimeReference.SERVER);
  const [selection, setSelection] = useState<Device[]>([]);

  const [commitInstall, isInstalling] = useMutation<InstallMutationType>(installSoftwareMutation);
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateSoftwareMutation);
  const [commitSchedule, isScheduling] = useMutation<CreateScheduleMutationType>(createSoftwareScheduleMutation);
  const isSubmitting = isInstalling || isUpdating || isScheduling;

  const osTypes = [...new Set(rows.map(row => PACKAGE_MANAGER_OS[row.packageManager]))];
  const deviceFilter: DeviceFilterInput = { statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE], osTypes };

  const fail = (title: string, description: string) => {
    toast({ title, description, variant: 'destructive' });
  };

  const runNow = (packages: PackageInput[]) => {
    const machineIds = selection.flatMap(device => (device.machineId ? [device.machineId] : []));
    const variables = { input: { machineIds, packages } };
    const onCompleted = () => {
      toast({
        title: copy.started,
        description: `${packages.length === 1 ? packages[0].packageName : `${packages.length} packages`} on ${machineIds.length} device${machineIds.length === 1 ? '' : 's'}.`,
        variant: 'success',
      });
      router.push(routes.software.executions({ ...packages[0], action }));
    };
    const onError = (error: Error) => fail('Error', getRelayErrorMessage(error, copy.failed));
    if (action === SoftwareAction.UPDATE) commitUpdate({ variables, onCompleted, onError });
    else commitInstall({ variables, onCompleted, onError });
  };

  const schedule = (packages: PackageInput[]) => {
    if (!date || !time) {
      fail('No start time', 'Pick a date and time for the schedule.');
      return;
    }
    if (isScheduleStartInPast(date, time, timeReference)) {
      fail('Invalid start time', PAST_START_MESSAGE);
      return;
    }
    commitSchedule({
      variables: {
        input: {
          name: `${copy.title.split(' ')[0]} ${packages.map(pkg => pkg.packageName).join(', ')}`,
          action,
          packages,
          timeReference,
          startAt: toScheduleInstant(applyTimeSlot(date, time), timeReference),
          // Schedules take Machine global ids, unlike the run-now mutations.
          machineIds: selection.map(device => device.id),
        },
      },
      onCompleted: () => {
        toast({ title: copy.scheduled, description: 'It will run at the scheduled time.', variant: 'success' });
        router.push(listRoute);
      },
      onError: error => fail('Error', getRelayErrorMessage(error, 'Failed to create the schedule')),
    });
  };

  const handleSubmit = () => {
    const packages = toPackageInputs(rows);
    if (!packages) {
      fail('No software selected', 'Pick a package in every row, or remove the empty ones.');
      return;
    }
    if (selection.length === 0) {
      fail('No devices selected', 'Please select at least one device.');
      return;
    }
    if (mode === 'now') runNow(packages);
    else schedule(packages);
  };

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    {
      label: mode === 'now' ? copy.runLabel : copy.scheduleLabel,
      variant: 'accent',
      onClick: handleSubmit,
      disabled: selection.length === 0,
      loading: isSubmitting,
    },
  ];

  const updateRow = (next: SoftwareRow) => setRows(current => current.map(row => (row.key === next.key ? next : row)));
  const removeRow = (key: string) => setRows(current => current.filter(row => row.key !== key));
  const addRow = () => setRows(current => [...current, newRow(crypto.randomUUID())]);

  return (
    <PageLayout
      title={copy.title}
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
        isDeviceDisabled={device => (hasMachineId(device) ? undefined : 'Agent is not\nconnected')}
      />
    </PageLayout>
  );
}
