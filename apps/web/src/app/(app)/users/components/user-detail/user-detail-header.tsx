'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  FloatingTooltip,
  NotFoundError,
  type PageActionButton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { userDetailHeader_person$key } from '@/__generated__/userDetailHeader_person.graphql';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { NO_CUSTOMER_REASON } from '../user-edit/edit-user-form';

const userDetailHeaderFragment = graphql`
  fragment userDetailHeader_person on DirectoryPerson {
    displayName
    accounts {
      id
      customers {
        __typename
      }
      details {
        jobTitle
      }
    }
  }
`;

/** A person's name runs past a phone's title line more often than not. */
const USER_TITLE_SKELETON_LINES = { phone: 2, md: 1, lg: 1 } as const;

export const USER_DETAIL_TITLE = 'User';

const EDIT_USER_LABEL = 'Edit User';
const EDIT_USER_ICON = <PenEditIcon className="h-5 w-5 text-ods-text-secondary" />;

const EDIT_USER_ACTION: PageActionButton = { label: EDIT_USER_LABEL, variant: 'outline', icon: EDIT_USER_ICON };

/**
 * Edit User, off, saying why. In the title's `selector` slot, not `actions`: a disabled button takes no pointer events,
 * so an action's own `tooltip` never opens, while this one hangs on the wrapper. The slot is desktop-only: a phone has
 * no hover to explain it with, so it draws no dead button.
 */
function EditUserUnavailable() {
  return (
    <FloatingTooltip content={NO_CUSTOMER_REASON} as="span">
      <Button variant="outline" leftIcon={EDIT_USER_ICON} disabled>
        {EDIT_USER_LABEL}
      </Button>
    </FloatingTooltip>
  );
}

/** The user page's title (Figma 1014:1222): the name over the job title, with Back and Edit User. */
export function UserTitle({
  title,
  subtitle,
  loading,
  actions,
  selector,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  actions?: PageActionButton[];
  selector?: ReactNode;
}) {
  const handleBack = useSafeBack(routes.users.list);
  return (
    <TitleBlock
      title={title}
      subtitle={subtitle}
      loading={loading}
      // Edit User is known before the record is: drawn for real and inert until the record says what it does.
      actions={loading ? [EDIT_USER_ACTION] : actions}
      loadingActions={loading}
      selector={selector}
      // The job title's line is held while the record is read, so the tabs do not drop when it lands.
      subtitleRow="while-loading"
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
  const account = person.accounts[0];
  const subtitle = account?.details?.jobTitle ?? undefined;
  // A write needs a customer that claims this account (contract §6).
  if (!account || account.customers.length === 0) {
    return <UserTitle title={person.displayName} subtitle={subtitle} selector={<EditUserUnavailable />} />;
  }
  const editAction: PageActionButton = {
    ...EDIT_USER_ACTION,
    // A client-side push, not `href`: the save returns with `router.back()`, and only an in-document navigation
    // keeps this page on the store the save has just updated (canon `customer-details-view`).
    onClick: () => router.push(routes.users.edit(account.id)),
  };
  return <UserTitle title={person.displayName} subtitle={subtitle} actions={[editAction]} />;
}
