import { type BrewPackageType, PackageManagerType } from '@/generated/schema-enums';
import type { SupportedPackageManager } from '../shared/package-managers';
import type { SelectedPackage } from './package-search-field';

/** One "Package Manager + Software Name" row of the form. */
export interface SoftwareRow {
  key: string;
  packageManager: SupportedPackageManager;
  pkg: SelectedPackage | null;
}

/** A row as the mutations take it. */
export interface PackageInput {
  packageManager: PackageManagerType;
  packageName: string;
  brewPackageType: BrewPackageType | null;
}

export function newSoftwareRow(key: string): SoftwareRow {
  return { key, packageManager: PackageManagerType.BREW, pkg: null };
}

/** Every row as the mutation's package input — null while any row is still empty. */
export function toPackageInputs(rows: SoftwareRow[]): PackageInput[] | null {
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
