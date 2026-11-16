'use client';

import { DEFAULT_DEVICES_LIST_STATUSES } from '@flamingo-stack/openframe-frontend-core/components/features';
import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { AnnouncementBarView, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { fetchQuery, useRelayEnvironment } from 'react-relay';
import type { outdatedClientCountRelayQuery } from '@/__generated__/outdatedClientCountRelayQuery.graphql';
import { useNonSuspendingQuery } from '@/app/hooks/use-non-suspending-query';
import { outdatedClientCountRelayQuery as query } from '@/graphql/devices/outdated-client-count-relay';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { routes } from '@/lib/routes';
import { useSubscriptionOpen } from './subscription-lock/subscription-guard';

/**
 * The base the bar counts under: the default Devices list's statuses, so the number agrees with the list Manage
 * Devices opens and archived or deleted devices are never counted.
 */
const VARIABLES = {
  filter: toRelayDeviceFilter({ statuses: [...DEFAULT_DEVICES_LIST_STATUSES] }),
  list: true,
} as const;

/**
 * How many devices run an OpenFrame client below the server's supported version; 0 while the answer is out, when it
 * fails, or when `enabled` is off. The threshold is the server's: nothing here compares versions.
 *
 * Asked once the subscription is open (`useSubscriptionOpen`: this is automatic traffic, so it waits below the guard
 * like the heartbeat), on app load and again each time the user enters the Devices section, where a reinstall is most
 * likely to have changed it. No polling. Never suspends or throws: a failure costs the bar, never the shell.
 */
export function useOutdatedClientCount(enabled: boolean): number {
  const environment = useRelayEnvironment();
  const open = useSubscriptionOpen();
  const asking = enabled && open;
  const inDevices = usePathname()?.startsWith(routes.devices.list) ?? false;

  const { data } = useNonSuspendingQuery<outdatedClientCountRelayQuery>(query, VARIABLES, asking);

  // Entering the Devices section asks again; the store-only read above shows the answer when it lands.
  useEffect(() => {
    if (!asking || !inDevices) return undefined;
    const subscription = fetchQuery<outdatedClientCountRelayQuery>(environment, query, VARIABLES, {
      fetchPolicy: 'network-only',
    }).subscribe({ error: () => undefined });
    return () => subscription.unsubscribe();
  }, [asking, inDevices, environment]);

  if (!asking) return 0;
  return data.deviceFilters?.clientOutdated.find(option => option.value === 'true')?.count ?? 0;
}

/**
 * App-wide bar for devices whose OpenFrame client is too old to update itself: it stays stuck until it is
 * reinstalled. Manage Devices opens the Devices list with those devices first.
 *
 * Not dismissible (the design has no close): it goes away when the last outdated client is reinstalled. It takes the
 * layout's `topBar` slot only when no billing bar and no hub announcement holds it (see `AppLayout`), so it never hides
 * an announcement.
 *
 * Height, type scale and CTA size are `AnnouncementBarView`'s and are not negotiable (its freeze notice); only the
 * surface colour and the slots are ours, as for the billing bars.
 */
export function OutdatedClientBar({ onManage }: { onManage: () => void }) {
  return (
    <AnnouncementBarView
      className="app-top-bar shrink-0 bg-ods-error text-ods-text-on-accent md:min-h-12"
      contentClassName="cursor-pointer md:cursor-default"
      onContentClick={onManage}
      startAdornment={<AlertTriangleIcon className="size-[var(--icon-size-icon-size)] shrink-0" />}
      title="Some devices run an outdated agent. Reinstall it to keep them connected."
      actionBlock={
        <Button variant="outline" size="small" onClick={onManage}>
          Manage Devices
        </Button>
      }
    />
  );
}

/** Where Manage Devices goes: the Devices list, outdated clients first, nothing filtered out. */
export const OUTDATED_CLIENT_DEVICES_HREF = routes.devices.filtered({ sort: 'clientOutdated' });
