import { graphql } from 'react-relay';

/** Schedules a deferred install or update of catalog packages on the given devices. */
export const createSoftwareScheduleMutation = graphql`
  mutation createSoftwareScheduleMutation($input: CreateSoftwareScheduleInput!) {
    createSoftwareSchedule(input: $input) {
      id
      name
    }
  }
`;
