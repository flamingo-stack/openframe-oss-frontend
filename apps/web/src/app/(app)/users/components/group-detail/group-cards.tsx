'use client';

import { providerMark } from '@flamingo-stack/openframe-frontend-core/components/features';
import { Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Fragment, type ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { groupCards_group$data, groupCards_group$key } from '@/__generated__/groupCards_group.graphql';
import { InfoCell } from '@/app/components/shared/info-cell';
import { groupMembershipLabel, groupTypeLabel, groupVisibilityLabel } from '../../utils/group-presentation';
import { groupFeedTag } from '../../utils/user-presentation';
import { DETAIL_CARD_CLASSES, DetailCell, RowDivider } from '../user-detail/detail-card';

const groupCardsFragment = graphql`
  fragment groupCards_group on DirectoryGroup {
    name
    provider
    kind
    memberCount
    feed
    email
    description
    connection {
      name
    }
    settings {
      dynamic
      membershipRule
      membershipPaused
      onPremisesSynced
      visibility
      adminCreated
    }
  }
`;

type Group = groupCards_group$data;

interface CardCell {
  key: string;
  node: ReactNode;
  /** Two of the four columns from `content-lg`: text that runs long (Figma's Description). */
  wide?: boolean;
}

/**
 * Where a row ends after each cell: two cells make a row below `content-lg`, four columns from it. A provider's settings
 * come and go per group ("null fields hidden", contract §2), so this is counted, not written out.
 */
function rowEnds(cells: readonly CardCell[]): (('narrow' | 'wide' | 'all') | null)[] {
  let columns = 0;
  return cells.map((cell, index) => {
    columns += cell.wide ? 2 : 1;
    if (index === cells.length - 1) return null;
    const narrow = (index + 1) % 2 === 0;
    const wide = columns % 4 === 0;
    if (narrow && wide) return 'all';
    if (narrow) return 'narrow';
    return wide ? 'wide' : null;
  });
}

function CardCells({ cells }: { cells: readonly CardCell[] }) {
  const ends = rowEnds(cells);
  return (
    <div className={DETAIL_CARD_CLASSES}>
      {cells.map((cell, index) => {
        const end = ends[index];
        return (
          <Fragment key={cell.key}>
            <DetailCell className={cell.wide ? 'content-lg:col-span-2' : undefined}>{cell.node}</DetailCell>
            {end && <RowDivider at={end} />}
          </Fragment>
        );
      })}
    </div>
  );
}

function FeedValue({ feed }: { feed: string | undefined }) {
  const loading = useLoadingScope();
  const tag = feed ? groupFeedTag(feed) : null;
  return <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />;
}

function TypeCell({ group }: { group: Group | null }) {
  const mark = group ? providerMark(group.provider) : null;
  return (
    <InfoCell
      label="Type"
      icon={mark && <mark.Logo size={24} role="img" aria-label={mark.label} />}
      iconSkeleton={{ size: 'md' }}
      value={group ? groupTypeLabel(group.kind) : null}
    />
  );
}

/** Whatever the provider says of it; each is null when that provider has no such setting. */
function settingsCells(settings: Group['settings'] | undefined): CardCell[] {
  const membership = settings ? groupMembershipLabel(settings) : null;
  const cells: (CardCell | false)[] = [
    (!settings || membership !== null) && {
      key: 'membership',
      node: <InfoCell label="Membership" value={membership} />,
    },
    !!settings?.membershipRule && {
      key: 'rule',
      wide: true,
      node: <InfoCell label="Membership rule" value={settings.membershipRule} />,
    },
    (!settings || settings.onPremisesSynced != null) && {
      key: 'source',
      node: <InfoCell label="Source" value={settings ? (settings.onPremisesSynced ? 'On-premises' : 'Cloud') : null} />,
    },
    settings?.adminCreated != null && {
      key: 'created-by',
      node: <InfoCell label="Created by" value={settings.adminCreated ? 'An admin' : 'A user'} />,
    },
  ];
  return cells.filter(cell => cell !== false);
}

/**
 * The group page's two cards (Figma 733:99325). Owners, Member types, Created, Expires and Team are in the frame but
 * not in the schema. In a loading scope (no group yet) the labels are real and the values are bars.
 */
export function GroupCards({ group: groupKey }: { group: groupCards_group$key | null }) {
  const loading = useLoadingScope();
  const group = useFragment(groupCardsFragment, groupKey) ?? null;
  // A group that is not there is the title's to say.
  if (!group && !loading) return null;
  const visibility = group?.settings.visibility;
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <CardCells
        cells={[
          { key: 'name', node: <InfoCell label="Group Name" value={group?.name} /> },
          { key: 'type', node: <TypeCell group={group} /> },
          { key: 'members', node: <InfoCell label="Members" value={group ? String(group.memberCount) : null} /> },
          { key: 'tenant', node: <InfoCell label="Tenant" value={group?.connection.name} /> },
          { key: 'feed', node: <InfoCell label="Feed" value={<FeedValue feed={group?.feed} />} /> },
        ]}
      />
      <CardCells
        cells={[
          { key: 'email', node: <InfoCell label="Email" value={group?.email} skeletonWidth="w-40" /> },
          ...(!group || visibility
            ? [
                {
                  key: 'visibility',
                  node: <InfoCell label="Visibility" value={visibility ? groupVisibilityLabel(visibility) : null} />,
                },
              ]
            : []),
          { key: 'description', wide: true, node: <InfoCell label="Description" value={group?.description} /> },
          ...settingsCells(group?.settings),
        ]}
      />
    </div>
  );
}
