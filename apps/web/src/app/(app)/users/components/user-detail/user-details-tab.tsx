'use client';

import { FloatingTooltip, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { graphql, useFragment } from 'react-relay';
import type {
  userDetailsTab_person$data,
  userDetailsTab_person$key,
} from '@/__generated__/userDetailsTab_person.graphql';
import { CustomerInfoCell } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { toCustomerOption } from '@/graphql/directory/customer-option';
import { formatDate } from '@/lib/format-date';
import { parseInstant } from '@/lib/graphql-scalars';
import { getFullImageUrl } from '@/lib/image-url';
import { routes } from '@/lib/routes';
import { readUserPhone } from '../../utils/user-phone';
import {
  lastSignInLabel,
  secondFactorValue,
  topAdminValue,
  userStatusTag,
  userStatusTooltip,
} from '../../utils/user-presentation';
import { DETAIL_CARD_CLASSES, DetailCell, RowDivider } from './detail-card';
import { UserTabHeading } from './user-tab-heading';

const userDetailsTabFragment = graphql`
  fragment userDetailsTab_person on DirectoryPerson {
    customers {
      organization {
        ...customerOption_organization
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
      ...userPhone_account
      details {
        aliases
        jobTitle
        department
        manager {
          displayName
          email
        }
        otherAdminRoles
      }
    }
  }
`;

type Account = userDetailsTab_person$data['accounts'][number];

/** A live value the provider did not answer for this time: the stored values are all the page has. */
const NOT_AVAILABLE = 'Not available';
const NOT_SET = 'Not set';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="text-ods-text-secondary text-h5">{title}</h3>
      <div className={DETAIL_CARD_CLASSES}>{children}</div>
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
 * The customers that claim the user, read-only from the rules (P2 closed: no primary customer). One is the logo and its
 * linked name; several are all of them, in rule order; none is the empty mark.
 */
function CustomerValue({ person }: { person: userDetailsTab_person$data | null }) {
  const customers = (person?.customers ?? []).map(claim => toCustomerOption(claim.organization));
  if (customers.length > 1) {
    return (
      <InfoCell
        label="Customer"
        value={customers.map(({ organizationId, name }, index) => (
          <span key={organizationId}>
            {index > 0 && ', '}
            <Link
              href={routes.customers.details(organizationId)}
              className="text-ods-accent underline hover:opacity-80"
            >
              {name}
            </Link>
          </span>
        ))}
      />
    );
  }
  const [customer] = customers;
  return (
    <CustomerInfoCell
      label="Customer"
      customer={
        customer
          ? {
              id: customer.organizationId,
              name: customer.name,
              logoUrl: getFullImageUrl(customer.image?.imageUrl, customer.image?.hash),
            }
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
  // The local phone is stored, so a failed live read still shows it (contract §2). Edit User clears it to `''`.
  const phone = account ? readUserPhone(account).phone || (account.details ? NOT_SET : NOT_AVAILABLE) : null;

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <UserTabHeading title="Details" />
      <Section title="Identity">
        <DetailCell>
          <InfoCell label="Primary email" value={account?.email} skeletonWidth="w-40" />
        </DetailCell>
        <DetailCell>
          <InfoCell
            label="Aliases"
            value={liveValue(account, details => (details.aliases.length > 0 ? details.aliases.join(', ') : 'None'))}
          />
        </DetailCell>
        <RowDivider at="narrow" />
        <DetailCell>
          <InfoCell label="Account" value={<StatusValue account={account} />} />
        </DetailCell>
        <DetailCell>
          <CustomerValue person={person} />
        </DetailCell>
        <RowDivider at="all" />
        <DetailCell>
          <InfoCell label="Job title" value={liveValue(account, details => details.jobTitle)} />
        </DetailCell>
        <DetailCell>
          <InfoCell label="Department" value={liveValue(account, details => details.department)} />
        </DetailCell>
        <RowDivider at="narrow" />
        <DetailCell>
          <InfoCell
            label="Manager"
            value={liveValue(account, details => details.manager?.displayName ?? details.manager?.email ?? null)}
          />
        </DetailCell>
        <DetailCell>
          <InfoCell label="Phone" value={phone} />
        </DetailCell>
      </Section>
      {/* Four across: Second factor takes two columns (1014:1243). Two across: it pairs with Last sign-in, and
          Created takes the last row (1019:3). */}
      <Section title="Access">
        <DetailCell>
          <InfoCell label="Top admin" value={account ? topAdminValue(account.topAdmin, account.source) : null} />
        </DetailCell>
        <DetailCell>
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
        </DetailCell>
        <RowDivider at="narrow" />
        <DetailCell className="content-lg:col-span-2">
          <InfoCell label="Second factor" value={account ? secondFactorValue(account.secondFactor) : null} />
        </DetailCell>
        <RowDivider at="wide" />
        <DetailCell>
          <InfoCell
            label="Last sign-in"
            value={account ? lastSignInLabel(account.lastSignInAt, account.signInData, 'calendar') : null}
          />
        </DetailCell>
        <RowDivider at="narrow" />
        <DetailCell className="col-span-2 content-lg:col-span-1">
          <InfoCell label="Created" value={account ? (created ? formatDate(created) : NOT_AVAILABLE) : null} />
        </DetailCell>
      </Section>
    </div>
  );
}
