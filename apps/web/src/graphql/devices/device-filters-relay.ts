import { graphql } from 'react-relay';

/**
 * Filter facets with counts — the status / device-type / OS / customer / tag
 * options the device filter UI offers, narrowed by the filter already applied.
 *
 * Separate from the list query on purpose: the facets are re-read whenever the
 * user changes a filter, while the list itself paginates independently.
 */
export const deviceFiltersRelayQuery = graphql`
  query deviceFiltersRelayQuery($filter: DeviceFilterInput) {
    deviceFilters(filter: $filter) {
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
  }
`;
