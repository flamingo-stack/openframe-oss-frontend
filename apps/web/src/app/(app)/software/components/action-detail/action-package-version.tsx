'use client';

import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { actionPackageVersionQuery as ActionPackageVersionQueryType } from '@/__generated__/actionPackageVersionQuery.graphql';
import { EmptyValue } from '@/app/components/shared';
import type { PackageManagerType } from '@/generated/schema-enums';

/** A catalog package's newest published version. */
const actionPackageVersionQuery = graphql`
  query actionPackageVersionQuery(
    $packageManager: PackageManagerType!
    $packageId: ID!
    $packageType: BrewPackageType
  ) {
    packageDetails(packageManager: $packageManager, packageId: $packageId, packageType: $packageType) {
      versions {
        version
      }
    }
  }
`;

interface ActionPackageVersionProps {
  packageManager: PackageManagerType;
  packageName: string;
}

/**
 * "Package Version": the latest version the catalog has. A run carries no
 * version of its own, and no Brew sub-type either — a formula and a cask
 * sharing a name read as empty. In a loading scope (its island's Suspense fallback) it draws its own loading state
 * and reads nothing.
 */
export function ActionPackageVersion(props: ActionPackageVersionProps) {
  if (useLoadingScope()) {
    return <ActionPackageVersionSkeleton />;
  }
  return <ActionPackageVersionQuery {...props} />;
}

/** The version line before the catalog answers. */
function ActionPackageVersionSkeleton() {
  return <UnifiedSkeleton as="span" className="h-6 w-20" />;
}

function ActionPackageVersionQuery({ packageManager, packageName }: ActionPackageVersionProps) {
  const { packageDetails } = useLazyLoadQuery<ActionPackageVersionQueryType>(
    actionPackageVersionQuery,
    { packageManager, packageId: packageName, packageType: null },
    { fetchPolicy: 'store-or-network' },
  );
  return <>{packageDetails.versions[0]?.version ?? <EmptyValue />}</>;
}
