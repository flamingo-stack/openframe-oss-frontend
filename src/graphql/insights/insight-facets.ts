import { graphql } from 'react-relay';

/**
 * The filter facets behind the Incidents table's column funnels, plus the
 * total the "N results" label prints. Spread by the list operation, so every
 * refetch of the list (a transition, Archive Resolved) refreshes them with it.
 *
 * `@inline` because the consumer maps the facets to plain dropdown options.
 */
export const insightFacetsFragment = graphql`
  fragment insightFacets_filters on InsightFilters @inline {
    types {
      value
      label
      count
    }
    severities {
      value
      label
      count
    }
    statuses {
      value
      label
      count
    }
    organizationIds {
      value
      label
      count
    }
    assigneeIds {
      value
      label
      count
    }
    filteredCount
  }
`;
