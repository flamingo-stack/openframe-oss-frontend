import { graphql } from 'react-relay';

/**
 * Filter facets for the schedule device picker — the SCHEDULE's own, not the
 * fleet's.
 *
 * The picker used to funnel through the root `deviceFilters`, which answers a
 * different question than the lists under it: it counts every machine in the
 * tenant, while each half of the picker is already scoped — Available to the
 * schedule's `supportedPlatforms`, Selected to what is assigned. So a Windows
 * schedule offered "macOS (14)" and filtering by it emptied the list, and the
 * Selected tab offered the whole fleet's customers next to five assigned rows.
 * `assignedDeviceFilters` / `availableDeviceFilters` are the same `DeviceFilters`
 * shape resolved over those scoped sets, so the options are the ones that
 * actually narrow something.
 *
 * Which halves are resolved is a VARIABLE, not the reading side's choice, so a
 * surface pays only for the facets it shows:
 *
 * - The details page's Assigned Devices tab asks for `assigned` alone — it has
 *   no second list, and resolving the available set would be work for nothing.
 * - The device PICKER asks for both at once, even though it draws one at a time.
 *   Its tab would otherwise be part of the cache key, and switching tabs would
 *   suspend on a request it has no cached answer for — dropping the whole editor,
 *   search box and all, to its skeleton on a click that should be free. (Same
 *   reason its two device lists are read together rather than one per tab.)
 *
 * `tagKeys` comes back empty from both fields for now (the backend documents it),
 * which is why the tag chips are fed from the fleet-wide facets instead — a
 * backend gap, not a wiring one.
 *
 * The two halves take SEPARATE filter variables because they describe different
 * sets by definition, not just by narrowing: Available is scoped to the statuses
 * a script may target (no PENDING_DELETION — see `toAvailableDeviceFilter`),
 * while Assigned must keep describing the whole assignment, strays included.
 * One shared variable would either offer "Pending deletion" as an available
 * option or hide an assigned stray from the Selected funnel.
 */
export const scheduleDeviceFiltersRelayQuery = graphql`
  query scheduleDeviceFiltersRelayQuery(
    $scheduleId: ID!
    $availableFilter: DeviceFilterInput
    $assignedFilter: DeviceFilterInput
    $search: String
    $available: Boolean!
    $assigned: Boolean!
  ) {
    scriptSchedule(id: $scheduleId) {
      id
      availableDeviceFilters(filter: $availableFilter, search: $search) @include(if: $available) {
        ...scheduleDeviceFiltersRelay_facets
      }
      assignedDeviceFilters(filter: $assignedFilter, search: $search) @include(if: $assigned) {
        ...scheduleDeviceFiltersRelay_facets
      }
    }
  }
`;

/**
 * The facet shape itself, shared by both fields above so the two branches cannot
 * drift — and so the reader has one fragment to spread rather than two identical
 * selections to keep in step.
 */
export const scheduleDeviceFiltersRelayFacetsFragment = graphql`
  fragment scheduleDeviceFiltersRelay_facets on DeviceFilters {
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
