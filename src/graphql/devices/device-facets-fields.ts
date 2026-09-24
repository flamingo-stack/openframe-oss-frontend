import { graphql, readInlineData } from 'react-relay';
import type { deviceFacetsFields_filters$key } from '@/__generated__/deviceFacetsFields_filters.graphql';
import type { DeviceFilters, TagFilterOption } from '@/app/(app)/devices/types/device.types';

/**
 * The facet shape of a scoped `DeviceFilters` field — a schedule's or a
 * bundle's `availableDeviceFilters` / `assignedDeviceFilters`. One selection
 * for every owner of such a pair, read by `toDeviceFilters` below, so the
 * branches cannot drift and the reader has one fragment to spread rather than
 * identical selections to keep in step.
 */
export const deviceFacetsFieldsFragment = graphql`
  fragment deviceFacetsFields_filters on DeviceFilters @inline {
    statuses {
      value
      label
      count
    }
    deviceTypes {
      value
      label
      count
    }
    osTypes {
      value
      label
      count
    }
    organizationIds {
      value
      label
      count
    }
    tagKeys {
      key
      value
      count
    }
    filteredCount
  }
`;

/** What a facet-less answer looks like — an owner that resolved to nothing. */
export const EMPTY_DEVICE_FILTERS: DeviceFilters = {
  statuses: [],
  deviceTypes: [],
  osTypes: [],
  organizationIds: [],
  tagKeys: [],
  filteredCount: 0,
};

/**
 * A scoped facet field as the picker's funnels take it.
 *
 * The one thing the scoped fields do NOT answer is tags: the backend documents
 * `tagKeys` as "currently always empty for the pickers", so the tag chips would
 * simply stop offering anything. They keep coming from the fleet-wide facets
 * (`fleetTagKeys`) until the scoped field carries them — preferred the moment it
 * does, so the fallback falls away without another edit here.
 *
 * Copies rather than casts: Relay hands back readonly arrays, and the table and
 * filter-modal helpers that consume `DeviceFilters` mutate theirs.
 */
export function toDeviceFilters(
  ref: deviceFacetsFields_filters$key | null | undefined,
  fleetTagKeys: TagFilterOption[],
): DeviceFilters {
  if (!ref) return { ...EMPTY_DEVICE_FILTERS, tagKeys: fleetTagKeys };
  const facets = readInlineData(deviceFacetsFieldsFragment, ref);
  return {
    statuses: [...facets.statuses],
    deviceTypes: [...facets.deviceTypes],
    osTypes: [...facets.osTypes],
    organizationIds: [...facets.organizationIds],
    tagKeys: facets.tagKeys.length > 0 ? [...facets.tagKeys] : fleetTagKeys,
    filteredCount: facets.filteredCount,
  };
}
