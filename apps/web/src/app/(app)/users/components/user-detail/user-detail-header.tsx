'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { LockIcon, LockOpenIcon, PenEditIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  FloatingTooltip,
  NotFoundError,
  type PageActionButton,
  Tag,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import type { userDetailHeader_person$key } from '@/__generated__/userDetailHeader_person.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { OrgUserSource, OrgUserStatus, OrgUserStatusReason } from '@/generated/schema-enums';
import { routes } from '@/lib/routes';
import { readOnlyTooltip } from '../../utils/group-presentation';
import { DEPROVISIONED_REASON, isDeprovisioned, NO_CUSTOMER_REASON } from '../user-edit/edit-user-form';
import { useSuspendUser } from './use-suspend-user';

const userDetailHeaderFragment = graphql`
  fragment userDetailHeader_person on DirectoryPerson {
    displayName
    accounts {
      id
      source
      status
      statusReason
      readOnlyReasons
      customers {
        organization {
          organizationId
        }
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
// Untinted: the button tones its icon slot itself, and dims it when the button is off.
const EDIT_USER_ICON = <PenEditIcon className="h-5 w-5" />;

const EDIT_USER_ACTION: PageActionButton = { label: EDIT_USER_LABEL, variant: 'outline', icon: EDIT_USER_ICON };

const SUSPEND_LABEL = 'Suspend';
const UNSUSPEND_LABEL = 'Unsuspend';
const SUSPEND_ICON = <LockIcon className="h-5 w-5" />;
const UNSUSPEND_ICON = <LockOpenIcon className="h-5 w-5" />;

// Drawn while the record is read, as Edit User is: most accounts come from a provider, so it rarely leaves again.
const SUSPEND_ACTION: PageActionButton = { label: SUSPEND_LABEL, variant: 'outline', icon: SUSPEND_ICON };

const NO_CUSTOMER_SUSPEND_REASON = "No customer claims this user yet, so its sign-in can't be changed.";
const DEPROVISIONED_SUSPEND_REASON = "Deprovisioned in the directory, so its sign-in can't be changed.";

// Google reports an Archived User licence as a suspension, and unsuspending does not lift it: only a licence change
// in the Admin console does, so the button would report a success that changed nothing.
const ARCHIVED_REASON = 'Archived in Google Workspace: restore it from the Admin console.';

/**
 * What Suspend does, asked before it is done (Unsuspend is not asked: it gives access back). Microsoft leaves the
 * sessions already open; Google ends them itself (contract W2-D14).
 */
function suspendConfirmation(source: string, name: string): string {
  return source === OrgUserSource.MICROSOFT_365
    ? `${name} will be blocked from signing in at Microsoft 365. Sessions already open stay open until they are ` +
        'revoked. The account, its mail, files and licence stay, and the licence is still billed. You can unsuspend ' +
        'the user at any time.'
    : `${name} will be suspended at Google Workspace and signed out. The account and its data stay, and it is ` +
        'still billed as an active user. You can unsuspend the user at any time.';
}

/** The steps PageActions sizes an action's glyph on (its ACTION_GLYPH_CLASSES, not exported), for a button beside it. */
const ACTION_GLYPH_CLASSES = 'inline-flex [&&_svg]:h-4 [&&_svg]:w-4 content-md:[&&_svg]:h-6 content-md:[&&_svg]:w-6';

/** What the button does at this account's provider: one word in OpenFrame, the provider's own verb here. */
function suspendTooltip(source: string, suspended: boolean): string {
  const microsoft = source === OrgUserSource.MICROSOFT_365;
  if (suspended) {
    return microsoft ? 'Allows sign-in at Microsoft 365 again.' : 'Restores the user at Google Workspace.';
  }
  return microsoft
    ? 'Blocks sign-in at Microsoft 365. The account, its mail, files and licence stay, and the licence is still billed. ' +
        'Reversible, and it does not start offboarding.'
    : 'Suspends the user at Google Workspace. The account and its data stay, and it is billed as an active user. ' +
        'Reversible, and it does not start offboarding.';
}

/**
 * An action that is off, saying why. In the title's `selector` slot, not `actions`: a disabled button takes no pointer
 * events, so an action's own `tooltip` never opens, while this one hangs on the wrapper. The slot is desktop-only: a
 * phone has no hover to explain it with, so it draws no dead button.
 */
function UnavailableAction({ label, icon, reason }: { label: string; icon: ReactNode; reason: string }) {
  return (
    <FloatingTooltip content={reason} as="span">
      <Button variant="outline" leftIcon={<span className={ACTION_GLYPH_CLASSES}>{icon}</span>} disabled>
        {label}
      </Button>
    </FloatingTooltip>
  );
}

/**
 * The user page's title (Figma 1014:1222): the initials, the name over the job title, with Back, Suspend and Edit
 * User. The initials are drawn while the record is read too, so the name does not move over when it lands; there is no
 * photo to show (contract F4).
 */
export function UserTitle({
  title,
  subtitle,
  loading,
  actions,
  selector,
  adornment,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  actions?: PageActionButton[];
  selector?: ReactNode;
  adornment?: ReactNode;
}) {
  const handleBack = useSafeBack(routes.users.list);
  return (
    <TitleBlock
      title={title}
      subtitle={subtitle}
      image={{ src: '', alt: loading ? '' : title }}
      titleAdornment={adornment}
      loading={loading}
      // The actions are known before the record is: drawn for real and inert until the record says what they do.
      actions={loading ? [SUSPEND_ACTION, EDIT_USER_ACTION] : actions}
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
  const { setSuspended, isSaving } = useSuspendUser();
  const [confirmingSuspend, setConfirmingSuspend] = useState(false);
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
  // Figma 1019:38344: the provider fields cannot be changed. Edit User stays, for the local ones (FE-Q15).
  const adornment =
    account && account.readOnlyReasons.length > 0 ? (
      <FloatingTooltip content={readOnlyTooltip(account.readOnlyReasons)} as="span">
        <Tag label="Read only" variant="grey" />
      </FloatingTooltip>
    ) : undefined;
  // A write is made for a customer that claims this account (contract §6).
  const organizationId = account?.customers[0]?.organization.organizationId;

  const selector: ReactNode[] = [];
  const actions: PageActionButton[] = [];
  let confirmation: ReactNode = null;

  // An OpenFrame account has no provider to block it at (contract W2-D12): deactivating one is another flow.
  if (account && account.source !== OrgUserSource.OPENFRAME) {
    const suspended = account.status === OrgUserStatus.SUSPENDED;
    const label = suspended ? UNSUSPEND_LABEL : SUSPEND_LABEL;
    const icon = suspended ? UNSUSPEND_ICON : SUSPEND_ICON;
    if (!organizationId) {
      const reason = isDeprovisioned(account.readOnlyReasons)
        ? DEPROVISIONED_SUSPEND_REASON
        : NO_CUSTOMER_SUSPEND_REASON;
      selector.push(<UnavailableAction key="suspend" label={label} icon={icon} reason={reason} />);
    } else if (account.readOnlyReasons.length > 0) {
      // The first read-only reason turns Suspend off as it does the provider fields (readOnlyReasons, contract §1),
      // both ways.
      selector.push(
        <UnavailableAction key="suspend" label={label} icon={icon} reason={readOnlyTooltip(account.readOnlyReasons)} />,
      );
    } else if (suspended && account.statusReason === OrgUserStatusReason.ARCHIVED) {
      selector.push(<UnavailableAction key="suspend" label={label} icon={icon} reason={ARCHIVED_REASON} />);
    } else {
      const target = { accountId: account.id, organizationId, name: person.displayName };
      actions.push({
        label,
        icon,
        variant: 'outline',
        // Capped as FloatingTooltip is: PageActions' tooltip has none, and draws this as one line wider than a tablet.
        tooltip: <span className="block max-w-xs">{suspendTooltip(account.source, suspended)}</span>,
        loading: isSaving,
        disabled: isSaving,
        onClick: () => (suspended ? setSuspended(target, false) : setConfirmingSuspend(true)),
      });
      confirmation = (
        <ConfirmDialog
          open={confirmingSuspend}
          onOpenChange={setConfirmingSuspend}
          title="Suspend User"
          description={suspendConfirmation(account.source, person.displayName)}
          confirmLabel="Suspend User"
          variant="warning"
          isPending={isSaving}
          onConfirm={() => setSuspended(target, true, () => setConfirmingSuspend(false))}
        />
      );
    }
  }

  if (!account || !organizationId) {
    const reason = account && isDeprovisioned(account.readOnlyReasons) ? DEPROVISIONED_REASON : NO_CUSTOMER_REASON;
    selector.push(<UnavailableAction key="edit" label={EDIT_USER_LABEL} icon={EDIT_USER_ICON} reason={reason} />);
  } else {
    actions.push({
      ...EDIT_USER_ACTION,
      // A client-side push, not `href`: the save returns with `router.back()`, and only an in-document navigation
      // keeps this page on the store the save has just updated (canon `customer-details-view`).
      onClick: () => router.push(routes.users.edit(account.id)),
    });
  }

  return (
    <>
      <UserTitle
        title={person.displayName}
        subtitle={subtitle}
        adornment={adornment}
        actions={actions}
        selector={selector.length > 0 ? selector : undefined}
      />
      {confirmation}
    </>
  );
}
