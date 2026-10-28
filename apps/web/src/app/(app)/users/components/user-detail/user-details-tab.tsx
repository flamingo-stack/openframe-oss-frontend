'use client';

import { FloatingTooltip, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  userDetailsTab_person$data,
  userDetailsTab_person$key,
} from '@/__generated__/userDetailsTab_person.graphql';
import { CustomerInfoCell } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { PrimaryCustomerState } from '@/generated/schema-enums';
import { formatDate } from '@/lib/format-date';
import { parseInstant } from '@/lib/graphql-scalars';
import { getFullImageUrl } from '@/lib/image-url';
import {
  lastSignInLabel,
  orderClaims,
  secondFactorValue,
  topAdminValue,
  userStatusTag,
  userStatusTooltip,
} from '../../utils/user-presentation';
import { UserTabHeading } from './user-tab-heading';

const userDetailsTabFragment = graphql`
  fragment userDetailsTab_person on DirectoryPerson {
    primaryCustomer {
      organizationId
    }
    primaryCustomerState
    customers {
      organization {
        organizationId
        name
        image {
          imageUrl
          hash
        }
      }
    }
    accounts {
      source
      email
      status
      statusReason
      statusDetail
      topAdmin
      secondFactor
      lastSignInAt
      signInData
      directoryCreatedAt
      phone
      details {
        aliases
        jobTitle
        department
        manager {
          displayName
          email
        }
        businessPhones
        mobilePhone
        otherAdminRoles
      }
    }
  }
`;

type Account = userDetailsTab_person$data['accounts'][number];

// The two cards of the Details tab (Figma 1014:1222): one grid, two cells a row below `content-lg` (tablet 1019:3,
// phone 1019:35005) and four from it, so a cell keeps its column across rows. Rows are 80px from `content-md`.
const CARD_CLASSES =
  'grid grid-cols-2 overflow-hidden rounded-md border border-ods-border bg-ods-card gap-x-[var(--spacing-system-s)] px-[var(--spacing-system-s)] content-md:gap-x-[var(--spacing-system-m)] content-md:px-[var(--spacing-system-m)] content-lg:grid-cols-4';
const CELL_CLASSES = 'flex min-w-0 items-center py-[var(--spacing-system-s)] content-md:min-h-20 content-md:py-0';

/** A live value the provider did not answer for this time: the stored values are all the page has. */
const NOT_AVAILABLE = 'Not available';
const NOT_SET = 'Not set';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="text-ods-text-secondary text-h5">{title}</h3>
      <div className={CARD_CLASSES}>{children}</div>
    </section>
  );
}

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(CELL_CLASSES, className)}>{children}</div>;
}

/**
 * The line between two rows, across the card's padding. Where a row ends depends on the width: `narrow` breaks only
 * where two cells make a row, `wide` only where four do, `all` at both.
 */
function RowDivider({ at }: { at: 'narrow' | 'wide' | 'all' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'col-span-full -mx-[var(--spacing-system-s)] h-px bg-ods-border content-md:-mx-[var(--spacing-system-m)]',
        at === 'narrow' && 'content-lg:hidden',
        at === 'wide' && 'hidden content-lg:block',
      )}
    />
  );
}

/** A provider field the live read returns: "Not set" when the provider holds none, "Not available" when unread. */
function liveValue(
  account: Account | null,
  read: (details: NonNullable<Account['details']>) => string | null | undefined,
) {
  if (!account) return null;
  if (!account.details) return NOT_AVAILABLE;
  return read(account.details) || NOT_SET;
}

function StatusValue({ account }: { account: Account | null }) {
  const loading = useLoadingScope();
  const tag = account ? userStatusTag(account.status) : null;
  const tooltip = account ? userStatusTooltip(account.statusReason, account.statusDetail) : null;
  return (
    <FloatingTooltip content={tooltip} disabled={!tooltip} as="span">
      <Tag label={tag?.label ?? ''} variant={tag?.variant} loading={loading} />
    </FloatingTooltip>
  );
}

/**
 * The customer the user belongs to: the primary one when several claim the user and one is chosen, "Not decided"
 * while none is (P2), the only one otherwise; the empty mark for a user no customer claims.
 */
function CustomerValue({ person }: { person: userDetailsTab_person$data | null }) {
  if (person && person.primaryCustomerState === PrimaryCustomerState.UNDECIDED) {
    return <InfoCell label="Customer" value="Not decided" />;
  }
  const claim = person ? orderClaims(person.customers, person.primaryCustomer?.organizationId)[0] : null;
  return (
    <CustomerInfoCell
      label="Customer"
      customer={
        person
          ? claim
            ? {
                id: claim.organization.organizationId,
                name: claim.organization.name,
                logoUrl: getFullImageUrl(claim.organization.image?.imageUrl, claim.organization.image?.hash),
              }
            : null
          : null
      }
    />
  );
}

/**
 * The Details tab (Figma 1014:1222): the two cards. In a loading scope (no person yet) the labels are real and the
 * values are bars; a person that is not there renders nothing — the header says "User not found".
 */
export function UserDetailsTab({ person: personKey }: { person: userDetailsTab_person$key | null }) {
  const loading = useLoadingScope();
  const person = useFragment(userDetailsTabFragment, personKey);
  if (!person && !loading) return null;
  return <UserDetailsCards person={person ?? null} />;
}

function UserDetailsCards({ person }: { person: userDetailsTab_person$data | null }) {
  const account = person?.accounts[0] ?? null;
  const roles = account?.details?.otherAdminRoles;
  const created = account?.directoryCreatedAt ? parseInstant(account.directoryCreatedAt) : null;
  // The local phone is stored, so a failed live read still shows it (contract §2).
  const phone =
    account && !account.details
      ? (account.phone ?? NOT_AVAILABLE)
      : liveValue(account, details => details.mobilePhone ?? details.businessPhones[0] ?? account?.phone ?? null);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <UserTabHeading title="Details" />
      <Section title="Identity">
        <Cell>
          <InfoCell label="Primary email" value={account?.email} skeletonWidth="w-40" />
        </Cell>
        <Cell>
          <InfoCell
            label="Aliases"
            value={liveValue(account, details => (details.aliases.length > 0 ? details.aliases.join(', ') : 'None'))}
          />
        </Cell>
        <RowDivider at="narrow" />
        <Cell>
          <InfoCell label="Account" value={<StatusValue account={account} />} />
        </Cell>
        <Cell>
          <CustomerValue person={person} />
        </Cell>
        <RowDivider at="all" />
        <Cell>
          <InfoCell label="Job title" value={liveValue(account, details => details.jobTitle)} />
        </Cell>
        <Cell>
          <InfoCell label="Department" value={liveValue(account, details => details.department)} />
        </Cell>
        <RowDivider at="narrow" />
        <Cell>
          <InfoCell
            label="Manager"
            value={liveValue(account, details => details.manager?.displayName ?? details.manager?.email ?? null)}
          />
        </Cell>
        <Cell>
          <InfoCell label="Phone" value={phone} />
        </Cell>
      </Section>
      {/* Four across: Second factor takes two columns (1014:1243). Two across: it pairs with Last sign-in, and
          Created takes the last row (1019:3). */}
      <Section title="Access">
        <Cell>
          <InfoCell label="Top admin" value={account ? topAdminValue(account.topAdmin, account.source) : null} />
        </Cell>
        <Cell>
          <InfoCell
            label="Other admin roles"
            value={
              account
                ? !account.details
                  ? NOT_AVAILABLE
                  : roles == null
                    ? 'Not readable'
                    : roles.length > 0
                      ? roles.join(', ')
                      : 'None'
                : null
            }
          />
        </Cell>
        <RowDivider at="narrow" />
        <Cell className="content-lg:col-span-2">
          <InfoCell label="Second factor" value={account ? secondFactorValue(account.secondFactor) : null} />
        </Cell>
        <RowDivider at="wide" />
        <Cell>
          <InfoCell
            label="Last sign-in"
            value={account ? lastSignInLabel(account.lastSignInAt, account.signInData, 'calendar') : null}
          />
        </Cell>
        <RowDivider at="narrow" />
        <Cell className="col-span-2 content-lg:col-span-1">
          <InfoCell label="Created" value={account ? (created ? formatDate(created) : NOT_AVAILABLE) : null} />
        </Cell>
      </Section>
    </div>
  );
}
