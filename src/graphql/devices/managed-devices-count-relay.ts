import { graphql } from 'react-relay';

/**
 * How many devices the fleet actually holds, straight from the device registry.
 *
 * A fragment on `Query` rather than its own query so the one consumer that needs
 * it — the subscription plan picker, which prices per device — can spread it into
 * the query it already runs. On the lock screen that query is what stands between
 * the user and the app, so a second round trip for a single number is exactly the
 * waterfall not worth paying.
 *
 * `first: 1` because nothing here reads the edges: `filteredCount` is the count of
 * everything matching the filter, independent of the page requested. Deliberately
 * NOT `subscription.usage.devicesUsed` — that counter is the billing service's own
 * metered figure, which is not the same thing as "devices in this instance right
 * now", and the plan picker must show the fleet the user can go and count.
 *
 * The caller passes the filter (see `DEFAULT_DEVICES_LIST_STATUSES`) so what counts
 * as a device here stays the same set the Devices page lists.
 */
export const managedDevicesCountFragment = graphql`
  fragment managedDevicesCountRelay_query on Query
  @argumentDefinitions(filter: { type: "DeviceFilterInput" }) {
    devices(filter: $filter, first: 1) {
      filteredCount
    }
  }
`;
