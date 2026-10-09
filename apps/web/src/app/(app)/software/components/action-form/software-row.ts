import type { SoftwareRow } from '@flamingo-stack/openframe-frontend-core/components/features';
import { type BrewPackageType, PackageManagerType } from '@/generated/schema-enums';

/** A row as the mutations take it. */
export interface PackageInput {
  packageManager: PackageManagerType;
  packageName: string;
  brewPackageType: BrewPackageType | null;
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
