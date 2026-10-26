'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { ErrorBoundary } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { actionPackageVersionQuery as ActionPackageVersionQueryType } from '@/__generated__/actionPackageVersionQuery.graphql';
import { EmptyValue, ValueText } from '@/app/components/shared';
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

/** The version's bar while the catalog is read. */
const VERSION_SKELETON_WIDTH = 'w-20';

interface ActionPackageVersionProps {
  packageManager: PackageManagerType;
  packageName: string;
}

/**
 * "Package Version": the latest version the catalog has. A run carries no
 * version of its own, and no Brew sub-type either — a formula and a cask
 * sharing a name read as empty. It loads on its own, and a failure reads as empty instead of taking the page down.
 */
export function ActionPackageVersion(props: ActionPackageVersionProps) {
  return (
    <ErrorBoundary fallback={<EmptyValue />}>
      <ActionPackageVersionValue {...props} />
    </ErrorBoundary>
  );
}

/** The version, with its own boundary: in its scope the reader draws its own loading form. */
function ActionPackageVersionValue(props: ActionPackageVersionProps) {
  return (
    <LoadingSuspense label="Loading package version">
      <ActionPackageVersionReader {...props} />
    </LoadingSuspense>
  );
}

function ActionPackageVersionReader(props: ActionPackageVersionProps) {
  // In a loading scope (its boundary's fallback) it draws its own loading state and reads nothing.
  if (useLoadingScope()) {
    return <ValueText value={null} skeletonWidth={VERSION_SKELETON_WIDTH} />;
  }
  return <ActionPackageVersionQuery {...props} />;
}

function ActionPackageVersionQuery({ packageManager, packageName }: ActionPackageVersionProps) {
  const { packageDetails } = useLazyLoadQuery<ActionPackageVersionQueryType>(
    actionPackageVersionQuery,
    { packageManager, packageId: packageName, packageType: null },
    { fetchPolicy: 'store-or-network' },
  );
  return <ValueText value={packageDetails.versions[0]?.version} skeletonWidth={VERSION_SKELETON_WIDTH} />;
}
