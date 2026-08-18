import { graphql } from 'react-relay';

/**
 * Step 1 of the device field ladder — what a row of `DevicesTableBody` draws:
 * the device name + icon, its customer, status and last-seen, plus the tags the
 * Device Tags filter narrows over.
 *
 * The narrowest step exists for `assignedDevices` (`script-schedule-devices-relay.ts`):
 * that field resolves per machine and has timed out once on test-dev, so the
 * schedule's Assigned Devices tab selects a row and nothing more. Everything
 * heavier lives in the steps above — see [deviceSelectorFields_machine] and
 * [deviceFields_machine], each of which spreads the step below it, so a caller
 * picks a depth instead of hand-listing fields and hoping they match the
 * transform.
 *
 * `@inline` because the consumer is `machineRowToDevice`, a plain function that
 * flattens a row into the `Device` the shared tables render — not a component.
 */
export const deviceRowFieldsFragment = graphql`
  fragment deviceRowFields_machine on Machine @inline {
    id
    machineId
    hostname
    displayName
    # type picks the DEVICE column's row icon; lastSeen is the line under the
    # status tag.
    osType
    status
    lastSeen
    type
    # The CUSTOMER column: logo + name. A per-machine fan-out, and the reason
    # this step is as small as it is.
    organization {
      id
      organizationId
      name
      image {
        imageUrl
        hash
      }
    }
    # Feeds the "Device Tags" filter, which narrows client-side over the pages
    # loaded so far. Selected whole here rather than split across the ladder: a
    # field selected at two steps lands in two separate $data types, and a tag
    # assembled from both halves would have to be zipped back together by index.
    tags {
      id
      key
      description
      color
      values
      createdAt
    }
  }
`;
