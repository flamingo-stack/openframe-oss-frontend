import { graphql } from 'react-relay';

/** A directory group as a list row draws it: the customer's Groups tab and the user page's Groups tab. */
export const groupRowFieldsFragment = graphql`
  fragment groupRowFields_group on DirectoryGroup @inline {
    id
    name
    provider
    memberCount
    feed
    connection {
      name
    }
  }
`;
