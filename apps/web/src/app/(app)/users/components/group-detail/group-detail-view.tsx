'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { NotFoundError, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { groupDetailViewQuery as GroupDetailViewQueryType } from '@/__generated__/groupDetailViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { routes } from '@/lib/routes';
import { GroupCards } from './group-cards';
import { GroupDetailTitle, GroupTitle } from './group-detail-title';
import { GroupMembersSection } from './group-members-table';

/**
 * The group page's record. With a customer the group must touch it. The title and the cards each read it in their own
 * island; both run this one query, so the page sends it once.
 */
const groupDetailViewQuery = graphql`
  query groupDetailViewQuery($id: ID!, $organizationId: ID) {
    directoryGroup(id: $id, organizationId: $organizationId) {
      ...groupDetailTitle_group
      ...groupCards_group
    }
  }
`;

interface IslandProps {
  id: string;
  customerId?: string;
}

function useGroupRecord({ id, customerId }: IslandProps) {
  const retryKey = useRetryKey();
  return (
    useLazyLoadQuery<GroupDetailViewQueryType>(
      groupDetailViewQuery,
      { id, organizationId: customerId ?? null },
      { fetchPolicy: 'store-and-network', fetchKey: retryKey },
    ).directoryGroup ?? null
  );
}

function TitleReader(props: IslandProps) {
  if (useLoadingScope()) return <GroupTitle customerId={props.customerId} adornment={<Tag label="" loading />} />;
  return <TitleQuery {...props} />;
}

function TitleQuery(props: IslandProps) {
  const router = useRouter();
  const group = useGroupRecord(props);
  if (group) return <GroupDetailTitle group={group} customerId={props.customerId} />;
  return (
    <>
      <GroupTitle customerId={props.customerId} />
      <NotFoundError
        message="Group not found"
        onHome={() =>
          router.replace(
            props.customerId ? routes.customers.details(props.customerId, { tab: 'user-groups' }) : routes.users.list,
          )
        }
      />
    </>
  );
}

function CardsReader(props: IslandProps) {
  if (useLoadingScope()) return <GroupCards group={null} />;
  return <CardsQuery {...props} />;
}

function CardsQuery(props: IslandProps) {
  return <GroupCards group={useGroupRecord(props)} />;
}

/** The title, its own island: the cards and the members below draw beside it. */
function TitleIsland({ loading = false, ...props }: IslandProps & { loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading group" gated={loading}>
      <TitleReader {...props} />
    </LoadingSuspense>
  );
}

function CardsIsland({ loading = false, ...props }: IslandProps & { loading?: boolean }) {
  return (
    <LoadingSuspense live label="Loading group details" gated={loading}>
      <CardsReader {...props} />
    </LoadingSuspense>
  );
}

/**
 * A directory group's page (Figma 733:99325). Not `PageLayout`: the record is read in islands, and the frame around them
 * draws from the first paint (canon `software-detail-view`).
 */
export function GroupDetailView({ id, customerId, loading = false }: IslandProps & { loading?: boolean }) {
  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)]">
      <TitleIsland id={id} customerId={customerId} loading={loading} />
      <CardsIsland id={id} customerId={customerId} loading={loading} />
      <GroupMembersSection id={id} customerId={customerId} loading={loading} />
    </div>
  );
}
