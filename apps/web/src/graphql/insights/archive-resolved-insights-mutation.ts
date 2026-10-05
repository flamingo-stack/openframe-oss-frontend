import { graphql } from 'react-relay';

/**
 * resolved → archived for every resolved incident of the tenant — not only the
 * rows on screen. Returns how many were filed away; it updates no record in the
 * store, so the caller refetches the lists it shows.
 */
export const archiveResolvedInsightsMutation = graphql`
  mutation archiveResolvedInsightsMutation {
    archiveResolvedInsights
  }
`;
