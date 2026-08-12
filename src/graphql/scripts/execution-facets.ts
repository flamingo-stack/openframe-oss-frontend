import { graphql } from 'react-relay';

/**
 * The filter facets behind an Execution History table's column funnels.
 *
 * `scriptExecutionFilters` and `scheduleExecutionFilters` both return
 * `ScriptExecutionFilters`, so the two lists share one fragment and one
 * `useExecutionFacetOptions` reader — the option shape can't drift between them.
 *
 * `count` is selected but unused by the dropdowns today: the facets ride the
 * list operation, so it costs nothing and is what a "(12)" beside an option
 * would read.
 *
 * `@inline` because the consumer is a hook that maps the facets to plain
 * dropdown options, not a component rendering the fragment.
 */
export const executionFacetsFragment = graphql`
  fragment executionFacets_filters on ScriptExecutionFilters @inline {
    statuses {
      value
      label
      count
    }
    initiators {
      value
      label
      count
    }
    machines {
      value
      label
      count
    }
  }
`;
