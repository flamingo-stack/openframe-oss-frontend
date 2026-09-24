'use client';

import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Suspense } from 'react';
import { InfoCell } from '@/app/components/shared/info-cell';
import { PACKAGE_MANAGER_LABEL, PACKAGE_MANAGERS, type SupportedPackageManager } from '../shared/package-managers';
import { PackageSearchField } from './package-search-field';
import { PackageSearchFieldPlaceholder } from './package-search-field-placeholder';
import type { SoftwareRow } from './software-row';

interface SoftwareRowFieldsProps {
  row: SoftwareRow;
  removable: boolean;
  onChange: (row: SoftwareRow) => void;
  onRemove: () => void;
}

/** One package to install or update: its manager, the package, and what the catalog says about it. */
export function SoftwareRowFields({ row, removable, onChange, onRemove }: SoftwareRowFieldsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)] lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <Select
          value={row.packageManager}
          onValueChange={value => onChange({ ...row, packageManager: value as SupportedPackageManager, pkg: null })}
        >
          <SelectTrigger label="Package Manager" labelVariant="large">
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

      <InfoCell value={row.pkg?.description} label="Description" />

      <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-lf)]">
        <InfoCell value={row.pkg?.version} label="Current Version" />
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
