'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  FileCheckIcon,
  FileContentIcon,
  MonitorIcon,
  UsersGroupIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type TabItem, TabNavigation, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type ComponentType, memo } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { userDetailViewQuery as UserDetailViewQueryType } from '@/__generated__/userDetailViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import type { UserDetailTab } from '@/lib/routes';
import { USER_DETAIL_TITLE, UserDetailHeader, UserTitle } from './user-detail-header';
import { UserDetailsTab } from './user-details-tab';
import { UserDevicesTab } from './user-devices-tab';
import { UserGroupsTab } from './user-groups-tab';
import { UserLicencesTab } from './user-licences-tab';

/**
 * The user page's record: the person who owns the account in `?id=`, that account first in `accounts` (contract
 * §1). The header and the Details tab each read it in their own island; both run this one query, so the page sends
 * it once. It carries `details`, a live provider read: fine on a single-record page, never in a list.
 */
const userDetailViewQuery = graphql`
  query userDetailViewQuery($id: ID!) {
    directoryUser(id: $id) {
      ...userDetailHeader_person
      ...userDetailsTab_person
    }
  }
`;

function useUserRecord(id: string) {
  const retryKey = useRetryKey();
  return (
    useLazyLoadQuery<UserDetailViewQueryType>(
      userDetailViewQuery,
      { id },
      { fetchPolicy: 'store-and-network', fetchKey: retryKey },
    ).directoryUser ?? null
  );
}

type IslandProps = { id: string; loading?: boolean };

function HeaderReader({ id }: { id: string }) {
  if (useLoadingScope()) return <UserTitle title={USER_DETAIL_TITLE} loading />;
  return <HeaderQuery id={id} />;
}

function HeaderQuery({ id }: { id: string }) {
  return <UserDetailHeader person={useUserRecord(id)} />;
}

function DetailsReader({ id }: { id: string }) {
  if (useLoadingScope()) return <UserDetailsTab person={null} />;
  return <DetailsQuery id={id} />;
}

function DetailsQuery({ id }: { id: string }) {
  return <UserDetailsTab person={useUserRecord(id)} />;
}

/** `memo`'d: `TabNavigation` defers the body, so one switch runs the render prop twice. */
const DetailsTabBody = memo(function DetailsTabBodyImpl({ id, loading = false }: IslandProps) {
  return (
    <LoadingSuspense live label="Loading user details" gated={loading}>
      <DetailsReader id={id} />
    </LoadingSuspense>
  );
});

/** The title, its own island: the tabs below draw from the first paint. */
function UserDetailHeaderIsland({ id, loading = false }: IslandProps) {
  return (
    <LoadingSuspense live label="Loading user" gated={loading}>
      <HeaderReader id={id} />
    </LoadingSuspense>
  );
}

/** The user page's tabs (Figma 1014:1222). Each body reads by account id on its own. */
const USER_DETAIL_TABS: TabItem[] = [
  { id: 'details' satisfies UserDetailTab, label: 'Details', icon: FileContentIcon, component: DetailsTabBody },
  { id: 'devices' satisfies UserDetailTab, label: 'Devices', icon: MonitorIcon, component: UserDevicesTab },
  { id: 'user-groups' satisfies UserDetailTab, label: 'User Groups', icon: UsersGroupIcon, component: UserGroupsTab },
  { id: 'licences' satisfies UserDetailTab, label: 'Licences', icon: FileCheckIcon, component: UserLicencesTab },
];

function userTabBody(tabId: string): ComponentType<IslandProps> {
  const tab = USER_DETAIL_TABS.find(item => item.id === tabId) ?? USER_DETAIL_TABS[0];
  return tab.component as ComponentType<IslandProps>;
}

/**
 * A directory user's page. Not `PageLayout`: the title is the record, so only the island that reads it waits
 * (canon `software-detail-view`); the tabs sit beside it and draw from the first paint.
 */
export function UserDetailView({ id, loading = false }: IslandProps) {
  return (
    <div className="flex w-full flex-col">
      <UserDetailHeaderIsland id={id} loading={loading} />
      {/* `TabNavigation` renders as a fragment: its bar and body grouped into one flex item. */}
      <div className="flex flex-1 flex-col pt-[var(--spacing-system-l)]">
        <TabNavigation tabs={USER_DETAIL_TABS} urlSync defaultTab={USER_DETAIL_TABS[0].id}>
          {activeTab => {
            const TabBody = userTabBody(activeTab);
            return <TabBody id={id} loading={loading} />;
          }}
        </TabNavigation>
      </div>
    </div>
  );
}
