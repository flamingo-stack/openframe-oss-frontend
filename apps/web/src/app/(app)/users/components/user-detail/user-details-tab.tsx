'use client';

import { FloatingTooltip, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
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

// The two cards of the Details tab (Figma 1014:1222), the tenant summary card's row shape: two columns on a phone,
// one row from `content-md` up.
const CARD_CLASSES = 'flex flex-col rounded-md border border-ods-border bg-ods-card';
const ROW_CLASSES =
  'grid grid-cols-2 gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] content-md:flex content-md:min-h-20 content-md:items-center content-md:py-0';
const DIVIDED_ROW_CLASSES = 'border-t border-ods-border';

/** A live value the provider did not answer for this time: the stored values are all the page has. */
const NOT_AVAILABLE = 'Not available';
const NOT_SET = 'Not set';

function Section({ title, rows }: { title: string; rows: ReactNode[] }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xs)]">
      <h3 className="text-ods-text-secondary text-h5">{title}</h3>
      <div className={CARD_CLASSES}>
        {rows.map((row, index) => (
          <div key={index} className={index > 0 ? `${ROW_CLASSES} ${DIVIDED_ROW_CLASSES}` : ROW_CLASSES}>
            {row}
          </div>
        ))}
      </div>
    </section>
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
  const phone = liveValue(
    account,
    details => details.mobilePhone ?? details.businessPhones[0] ?? account?.phone ?? null,
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Details</h2>
      <Section
        title="Identity"
        rows={[
          <>
            <InfoCell label="Primary email" value={account?.email} skeletonWidth="w-40" />
            <InfoCell
              label="Aliases"
              value={liveValue(account, details => (details.aliases.length > 0 ? details.aliases.join(', ') : 'None'))}
            />
            <InfoCell label="Account" value={<StatusValue account={account} />} />
            <CustomerValue person={person} />
          </>,
          <>
            <InfoCell label="Job title" value={liveValue(account, details => details.jobTitle)} />
            <InfoCell label="Department" value={liveValue(account, details => details.department)} />
            <InfoCell
              label="Manager"
              value={liveValue(account, details => details.manager?.displayName ?? details.manager?.email ?? null)}
            />
            <InfoCell label="Phone" value={phone} />
          </>,
        ]}
      />
      <Section
        title="Access"
        rows={[
          <>
            <InfoCell label="Top admin" value={account ? topAdminValue(account.topAdmin, account.source) : null} />
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
            <InfoCell label="Second factor" value={account ? secondFactorValue(account.secondFactor) : null} />
          </>,
          <>
            <InfoCell
              label="Last sign-in"
              value={account ? lastSignInLabel(account.lastSignInAt, account.signInData, 'calendar') : null}
            />
            <InfoCell label="Created" value={account ? (created ? formatDate(created) : NOT_AVAILABLE) : null} />
          </>,
        ]}
      />
    </div>
  );
}
