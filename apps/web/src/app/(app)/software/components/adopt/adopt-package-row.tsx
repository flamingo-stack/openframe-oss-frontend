'use client';

import { OSTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { adoptPackageRow_software$key } from '@/__generated__/adoptPackageRow_software.graphql';
import { ValueText } from '@/app/components/shared';
import { adoptionPackageManagerLabel } from './adoption-package-manager';

const OS_ICON_SIZE = 'size-5';

const adoptPackageRowFragment = graphql`
  fragment adoptPackageRow_software on Software {
    os
    adoptionPackage {
      packageManager
      version
    }
  }
`;

/**
 * One package-manager row of the Adopt page (designs 1227:569, 1634:9683): the manager, the package's version beside
 * the system it installs on, and the row's remove button. The server picks the one package a title is adopted with, so
 * the row is the only one: the manager is its own single choice, and the row cannot be removed. Null while the title
 * is read: the same row with its values loading.
 */
export function AdoptPackageRow({ software }: { software: adoptPackageRow_software$key | null }) {
  const data = useFragment(adoptPackageRowFragment, software);
  const pkg = data?.adoptionPackage;
  const os = data?.os;
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)] content-md:flex-row content-md:items-end">
      <div className="min-w-0 content-md:flex-[2]">
        <Select value={pkg?.packageManager ?? ''} disabled={!pkg}>
          <SelectTrigger label="Package Manager" labelVariant="large">
            <SelectValue placeholder="Select Package Manager" />
          </SelectTrigger>
          <SelectContent>
            {pkg && (
              <SelectItem value={pkg.packageManager}>{adoptionPackageManagerLabel(pkg.packageManager)}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-lf)]">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
            {os && <OSTypeIcon osType={os} size={OS_ICON_SIZE} />}
            <ValueText value={pkg?.version} loading={!pkg} skeletonWidth="w-16" />
          </div>
          <p className="truncate text-ods-text-secondary text-h6">Current Version</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Remove package manager"
          disabled
          leftIcon={<TrashIcon size={24} className="text-ods-text-secondary" />}
        />
      </div>
    </div>
  );
}
