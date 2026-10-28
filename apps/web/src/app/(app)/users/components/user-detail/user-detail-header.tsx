'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { NotFoundError } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { graphql, useFragment } from 'react-relay';
import type { userDetailHeader_person$key } from '@/__generated__/userDetailHeader_person.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';

const userDetailHeaderFragment = graphql`
  fragment userDetailHeader_person on DirectoryPerson {
    displayName
    accounts {
      details {
        jobTitle
      }
    }
  }
`;

/** A person's name runs past a phone's title line more often than not. */
const USER_TITLE_SKELETON_LINES = { phone: 2, md: 1, lg: 1 } as const;

export const USER_DETAIL_TITLE = 'User';

/** The user page's title (Figma 1014:1222): the name over the job title, with Back. */
export function UserTitle({ title, subtitle, loading }: { title: string; subtitle?: string; loading?: boolean }) {
  const handleBack = useSafeBack(routes.users.list);
  return (
    <TitleBlock
      title={title}
      subtitle={subtitle}
      loading={loading}
      titleSkeletonLines={USER_TITLE_SKELETON_LINES}
      backButton={{ label: 'Back', onClick: handleBack }}
    />
  );
}

/** The title once the record answered; a missing person is "User not found" (contract §4: null, not an error). */
export function UserDetailHeader({ person: personKey }: { person: userDetailHeader_person$key | null }) {
  const router = useRouter();
  const person = useFragment(userDetailHeaderFragment, personKey);
  if (!person) {
    return (
      <>
        <UserTitle title={USER_DETAIL_TITLE} />
        <NotFoundError message="User not found" onHome={() => router.replace(routes.users.list)} />
      </>
    );
  }
  return <UserTitle title={person.displayName} subtitle={person.accounts[0]?.details?.jobTitle ?? undefined} />;
}
