'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type PageActionButton,
  RadioGroupBlock,
  type RadioGroupBlockOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense, useState } from 'react';
import { DEVICE_STATUS } from '@/app/(app)/devices/constants/device-statuses';
import type { Device, DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { getDevicePrimaryId } from '@/app/(app)/scripts/shared/utils/device-helpers';
import { DeviceListPicker } from '@/app/components/shared/device-selector';
import { InfoCell } from '@/app/components/shared/info-cell';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { PackageManagerType } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { PackageSearchField, PackageSearchFieldPlaceholder, type SelectedPackage } from './package-search-field';

const PACKAGE_MANAGER_LABEL: Record<PackageManagerType, string> = {
  BREW: 'Brew',
  CHOCO: 'Chocolatey',
  WINGET: 'WinGet',
};

/** The OS each catalog installs on — what narrows the device list below. */
const PACKAGE_MANAGER_OS: Record<PackageManagerType, 'MAC_OS' | 'WINDOWS'> = {
  BREW: 'MAC_OS',
  CHOCO: 'WINDOWS',
  WINGET: 'WINDOWS',
};

const PACKAGE_MANAGERS = Object.values(PackageManagerType);

type InstallMode = 'now' | 'schedule';

const INSTALL_MODE_OPTIONS: RadioGroupBlockOption[] = [
  { value: 'now', label: 'Install Now', description: 'The install starts immediately.' },
  {
    value: 'schedule',
    label: 'Schedule Install',
    description: 'The install runs automatically at the scheduled time.',
  },
];

interface SoftwareRow {
  key: string;
  packageManager: PackageManagerType;
  pkg: SelectedPackage | null;
}

function newRow(key: string): SoftwareRow {
  return { key, packageManager: PackageManagerType.BREW, pkg: null };
}

function hasMachineId(device: Device): boolean {
  return !!device.machineId;
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

/**
 * Install Software (design 258:24314): what to install — one row per package,
 * picked from a package-manager catalog — when, and on which devices.
 *
 * "Run Installation" stays disabled: the schema has no install mutation (neither
 * immediate nor scheduled), so there is nothing this page could send yet.
 */
export function InstallSoftwareView() {
  const handleBack = useSafeBack(routes.software.list);
  const [rows, setRows] = useState<SoftwareRow[]>(() => [newRow('row-0')]);
  const [installMode, setInstallMode] = useState<InstallMode>('now');
  const [selection, setSelection] = useState<Device[]>([]);

  const osTypes = [...new Set(rows.map(row => PACKAGE_MANAGER_OS[row.packageManager]))];
  const deviceFilter: DeviceFilterInput = {
    statuses: [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE],
    osTypes,
  };

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    { label: 'Run Installation', variant: 'accent', disabled: true },
  ];

  const updateRow = (next: SoftwareRow) => setRows(current => current.map(row => (row.key === next.key ? next : row)));
  const removeRow = (key: string) => setRows(current => current.filter(row => row.key !== key));
  const addRow = () => setRows(current => [...current, newRow(crypto.randomUUID())]);

  return (
    <PageLayout
      title="Install Software"
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
        name="installMode"
        variant="grouped"
        value={installMode}
        onValueChange={value => setInstallMode(value as InstallMode)}
        options={INSTALL_MODE_OPTIONS}
        itemClassName="py-[var(--spacing-system-sf)]"
      />

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
