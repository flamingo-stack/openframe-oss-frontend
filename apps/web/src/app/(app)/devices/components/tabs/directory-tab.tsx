'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { AddressBookIcon, UsersIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LeaderRow, Tag, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type {
  directoryTabQuery$data,
  directoryTabQuery as DirectoryTabQueryType,
} from '@/__generated__/directoryTabQuery.graphql';
import { UserTabHeading } from '@/app/(app)/users/components/user-detail/user-tab-heading';
import { lastSignInLabel } from '@/app/(app)/users/utils/user-presentation';
import { useRetryKey } from '@/app/components/shared';
import { DirectoryReadability } from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDate } from '@/lib/format-date';
import { parseInstant } from '@/lib/graphql-scalars';
import type { Device } from '../../types/device.types';
import {
  entraJoinTypeLabel,
  intuneComplianceTag,
  intuneManagementLabel,
  intuneOwnerLabel,
  intuneUnavailableCopy,
} from '../../utils/directory-presentation';
import { TabEmptyState } from './tab-empty-state';

/** `cards` is a live provider read (contract §6): this query is the tab's own, and only this tab sends it. */
const directoryTabQuery = graphql`
  query directoryTabQuery($machineId: ID!) {
    deviceDirectory(machineId: $machineId) {
      intuneUnavailable
      cards {
        liveDataUnavailable
        record {
          id
        }
        entra {
          joinType
          managed
          compliant
          approximateLastSignInAt
          owners {
            id
            displayName
          }
          memberOf {
            id
            name
          }
        }
        intune {
          complianceState
          encrypted
          ownerType
          management
          enrolledAt
          lastSyncAt
          primaryUser {
            id
            displayName
          }
        }
      }
    }
  }
`;

type DeviceDirectory = directoryTabQuery$data['deviceDirectory'];
type Card = DeviceDirectory['cards'][number];

const YES_NO_CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]';

/** A yes or no the provider may not say (Figma 891:85438): green for the good answer, unknown as the empty mark. */
function YesNo({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <>{EMPTY_VALUE}</>;
  return <Tag label={value ? 'Yes' : 'No'} variant={value ? 'success' : 'grey'} />;
}

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
      <h3 className="text-ods-text-secondary text-h5">{title}</h3>
      {children}
    </section>
  );
}

const STALE_HINT = "Couldn't read this from the directory just now. These are the stored values.";

function StaleHint({ stale }: { stale: boolean }) {
  return stale ? <p className="text-ods-text-secondary text-h6">{STALE_HINT}</p> : null;
}

function EntraCard({ entra, stale }: { entra: NonNullable<Card['entra']>; stale: boolean }) {
  const signedIn = entra.approximateLastSignInAt;
  return (
    <CardSection title="Entra ID">
      <div className={YES_NO_CARD_CLASS}>
        <LeaderRow label="Join type" value={entra.joinType ? entraJoinTypeLabel(entra.joinType) : EMPTY_VALUE} />
        <LeaderRow label="Compliant" value={<YesNo value={entra.compliant} />} />
        <LeaderRow label="Managed by MDM" value={<YesNo value={entra.managed} />} />
        <LeaderRow
          label="Last sign-in"
          value={
            signedIn ? `${lastSignInLabel(signedIn, DirectoryReadability.READ, 'calendar')} (approximate)` : EMPTY_VALUE
          }
        />
        <LeaderRow
          label="Registered owner"
          value={entra.owners.length > 0 ? entra.owners.map(owner => owner.displayName).join(', ') : 'None'}
        />
        <LeaderRow
          label="Member of"
          value={entra.memberOf.length > 0 ? entra.memberOf.map(group => group.name).join(', ') : EMPTY_VALUE}
        />
        <StaleHint stale={stale} />
      </div>
    </CardSection>
  );
}

function IntuneCard({ intune, stale }: { intune: NonNullable<Card['intune']>; stale: boolean }) {
  const compliance = intuneComplianceTag(intune.complianceState);
  const enrolled = intune.enrolledAt ? parseInstant(intune.enrolledAt) : null;
  return (
    <CardSection title="Intune">
      <div className={YES_NO_CARD_CLASS}>
        <LeaderRow label="Primary user" value={intune.primaryUser?.displayName ?? 'None'} />
        <LeaderRow label="Ownership" value={intuneOwnerLabel(intune.ownerType)} />
        <LeaderRow label="Compliance" value={<Tag label={compliance.label} variant={compliance.variant} />} />
        <LeaderRow label="Encrypted" value={<YesNo value={intune.encrypted} />} />
        <LeaderRow label="Management" value={intuneManagementLabel(intune.management)} />
        <LeaderRow label="Enrolled" value={enrolled ? formatDate(enrolled) : EMPTY_VALUE} />
        <LeaderRow
          label="Last check-in"
          value={intune.lastSyncAt ? formatRelativeTime(intune.lastSyncAt) : EMPTY_VALUE}
        />
        <StaleHint stale={stale} />
      </div>
    </CardSection>
  );
}

/** "No Intune licence" or "No Intune access" in the Intune card's place (Figma 882:63137, 1371:246). */
function IntuneUnavailable({ reason }: { reason: string | null | undefined }) {
  const copy = intuneUnavailableCopy(reason);
  if (!copy) return null;
  return (
    <CardSection title="Intune">
      <div className="flex flex-col items-center gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)] text-center">
        <UsersIcon size={24} className="text-ods-text-secondary" />
        <div className="flex flex-col">
          <p className="text-ods-text-secondary text-h4">{copy.title}</p>
          <p className="text-ods-text-secondary text-h6">{copy.description}</p>
        </div>
      </div>
    </CardSection>
  );
}

function DirectoryCards({ directory }: { directory: DeviceDirectory | null }) {
  const loading = useLoadingScope();
  const cards = directory?.cards ?? [];
  const intuneCopy = intuneUnavailableCopy(directory?.intuneUnavailable);
  if (!loading && cards.length === 0 && !intuneCopy) {
    return (
      <TabEmptyState
        icon={<AddressBookIcon />}
        title="No directory records"
        description="No Microsoft 365 record is linked to this device."
      />
    );
  }
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <UserTabHeading title="Directory" />
      {loading ? (
        <div className={YES_NO_CARD_CLASS}>
          {['Join type', 'Compliant', 'Managed by MDM', 'Last sign-in'].map(label => (
            <LeaderRow key={label} label={label} value="" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-[var(--spacing-system-m)] content-md:grid-cols-2">
          {cards.map(card => (
            <div key={`${card.record.id}:${card.entra ? 'entra' : 'intune'}`} className="min-w-0">
              {card.entra && <EntraCard entra={card.entra} stale={card.liveDataUnavailable} />}
              {card.intune && <IntuneCard intune={card.intune} stale={card.liveDataUnavailable} />}
            </div>
          ))}
          <IntuneUnavailable reason={directory?.intuneUnavailable} />
        </div>
      )}
    </div>
  );
}

function DirectoryQuery({ machineId }: { machineId: string }) {
  const retryKey = useRetryKey();
  const { deviceDirectory } = useLazyLoadQuery<DirectoryTabQueryType>(
    directoryTabQuery,
    { machineId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  return <DirectoryCards directory={deviceDirectory} />;
}

function DirectoryReader({ machineId }: { machineId: string | null }) {
  if (useLoadingScope() || !machineId) return <DirectoryCards directory={null} />;
  return <DirectoryQuery machineId={machineId} />;
}

/** Device page → Directory (Figma 891:85438). */
export function DirectoryTab({ device }: { device: Device | null }) {
  const machineId = device?.machineId ?? null;
  return (
    <LoadingSuspense live label="Loading directory" gated={!machineId}>
      <DirectoryReader machineId={machineId} />
    </LoadingSuspense>
  );
}
