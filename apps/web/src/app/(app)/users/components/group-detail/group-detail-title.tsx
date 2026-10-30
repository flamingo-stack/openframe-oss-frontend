'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { FloatingTooltip, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { groupDetailTitle_group$key } from '@/__generated__/groupDetailTitle_group.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { readOnlyTooltip } from '../../utils/group-presentation';

const groupDetailTitleFragment = graphql`
  fragment groupDetailTitle_group on DirectoryGroup {
    readOnlyReasons
  }
`;

export const GROUP_DETAIL_TITLE = 'Group Details';

/** The page's title with Back: to the customer's Groups tab it came from, else the Users list. */
export function GroupTitle({ customerId, adornment }: { customerId?: string; adornment?: ReactNode }) {
  const handleBack = useSafeBack(
    customerId ? routes.customers.details(customerId, { tab: 'user-groups' }) : routes.users.list,
  );
  return (
    <TitleBlock
      title={GROUP_DETAIL_TITLE}
      titleAdornment={adornment}
      backButton={{ label: 'Back', onClick: handleBack }}
    />
  );
}

/** "Group Details" and its READ ONLY tag (Figma 733:99325): OpenFrame never edits a group from these pages. */
export function GroupDetailTitle({
  group: groupKey,
  customerId,
}: {
  group: groupDetailTitle_group$key;
  customerId?: string;
}) {
  const { readOnlyReasons } = useFragment(groupDetailTitleFragment, groupKey);
  return (
    <GroupTitle
      customerId={customerId}
      adornment={
        <FloatingTooltip content={readOnlyTooltip(readOnlyReasons)} as="span">
          <Tag label="Read only" variant="grey" />
        </FloatingTooltip>
      }
    />
  );
}
