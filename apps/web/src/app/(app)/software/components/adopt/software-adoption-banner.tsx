'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { softwareAdoptionBannerQuery as SoftwareAdoptionBannerQueryType } from '@/__generated__/softwareAdoptionBannerQuery.graphql';
import { ContentErrorBoundary, useRetryKey } from '@/app/components/shared';
import { pluralNoun } from '@/lib/pluralize';
import { routes } from '@/lib/routes';
import { SoftwareNoticeBanner } from '../shared/software-notice-banner';
import { ADOPT_DEVICE_LIMIT, ADOPTABLE_DEVICES_FILTER, isAdopting } from './adoptable-devices';
import { adoptionPackageManagerLabel } from './adoption-package-manager';

/**
 * The title's adoption package, `adoptionCount` (the devices an order would reach: an agent new enough, the package
 * manager present, the app not only in ~/Applications, its cask not installed yet) and the Adopt page's list, whose
 * running adoptions come off that count. The list's size stands in for a server that does not fill the count.
 */
const softwareAdoptionBannerQuery = graphql`
  query softwareAdoptionBannerQuery($id: ID!, $filter: SoftwareOnDeviceFilterInput!, $first: Int!) {
    software(id: $id) {
      id
      name
      adoptionCount
      adoptionPackage {
        packageManager
      }
    }
    softwareDevices(softwareId: $id, filter: $filter, first: $first) {
      filteredCount
      edges {
        node {
          adoption {
            status
          }
        }
      }
    }
  }
`;

/**
 * "N devices have <software> installed manually" over the Devices list (design 1100:444, 1239:1238, 1239:20729), with
 * Adopt: the page that reinstalls the title on them with its adoption package. Only for a title that has one and has
 * devices to adopt; otherwise nothing, and nothing while it is read or when the read fails: it is a hint over the list,
 * not part of it.
 */
export function SoftwareAdoptionBanner({ softwareId, loading = false }: { softwareId: string; loading?: boolean }) {
  return (
    <ContentErrorBoundary label="software-adoption-banner" fallback={() => <></>}>
      <SoftwareAdoptionBannerBoundary softwareId={softwareId} loading={loading} />
    </ContentErrorBoundary>
  );
}

function SoftwareAdoptionBannerBoundary({ softwareId, loading }: { softwareId: string; loading: boolean }) {
  return (
    <LoadingSuspense live gated={loading} label="Loading adoption">
      <SoftwareAdoptionBannerReader softwareId={softwareId} />
    </LoadingSuspense>
  );
}

function SoftwareAdoptionBannerReader({ softwareId }: { softwareId: string }) {
  if (useLoadingScope()) return null;
  return <SoftwareAdoptionBannerQuery softwareId={softwareId} />;
}

function SoftwareAdoptionBannerQuery({ softwareId }: { softwareId: string }) {
  const retryKey = useRetryKey();
  const { software, softwareDevices } = useLazyLoadQuery<SoftwareAdoptionBannerQueryType>(
    softwareAdoptionBannerQuery,
    { id: softwareId, filter: ADOPTABLE_DEVICES_FILTER, first: ADOPT_DEVICE_LIMIT },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const manager = software?.adoptionPackage?.packageManager;
  // The server counts the devices an order would reach, a running adoption's included: those are taken off, from the
  // page read (as long as one adoption, 100). Without the server's count, the Adopt page's list stands in.
  const adopting = softwareDevices.edges.filter(edge => isAdopting(edge.node.adoption?.status)).length;
  const count = (software?.adoptionCount ?? softwareDevices.filteredCount) - adopting;
  if (!software || !manager || count <= 0) return null;

  const devices = `${count} ${pluralNoun(count, 'device')}`;
  return (
    <SoftwareNoticeBanner
      title={`${devices} ${count === 1 ? 'has' : 'have'} ${software.name} installed manually`}
      description={`OpenFrame can update it only when a package manager installed it. Click Adopt to reinstall it on ${count === 1 ? 'this device' : 'these devices'} with ${adoptionPackageManagerLabel(manager)}, so it can be updated.`}
      actionLabel="Adopt"
      actionHref={routes.software.adopt(software.id)}
      className="mb-[var(--spacing-system-l)]"
    />
  );
}
