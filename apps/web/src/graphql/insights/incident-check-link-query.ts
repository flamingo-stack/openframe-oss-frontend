import { graphql } from 'react-relay';

/** The name of the check that opened an incident, for the link to its page in the incident's details. */
export const incidentCheckLinkQuery = graphql`
  query incidentCheckLinkQuery($check: String!) {
    insightCheck(check: $check) {
      title
    }
  }
`;
