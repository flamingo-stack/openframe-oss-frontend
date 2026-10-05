import { graphql } from 'react-relay';

/**
 * Step 2 of the insight field ladder — the detail page. Spreads the row step
 * and adds what only the detail page draws: the detecting query's
 * description and interval, the osquery evidence rows, and the customer's logo.
 * Read by `toIncident` (`incidents/utils/incident-transform.ts`).
 */
export const insightFieldsFragment = graphql`
  fragment insightFields_insight on Insight @inline {
    ...insightRowFields_insight
    description
    interval
    queryResult
    organization {
      image {
        imageUrl
        hash
      }
    }
  }
`;
