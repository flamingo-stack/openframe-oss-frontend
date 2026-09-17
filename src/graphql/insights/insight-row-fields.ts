import { graphql } from 'react-relay';

/**
 * What a row of the Incidents table draws: the finding, the machine it is about,
 * its customer, severity and status. Kept as the narrowest step on purpose —
 * `description` and `queryResult` (the osquery evidence rows) are detail-page
 * payload and can be large, so the list never selects them.
 *
 * `@inline` because the consumer is `toIncidentRow`, a plain function that
 * flattens the node into the shape the table renders — not a component.
 *
 * `machineId` / `organizationId` are the RAW ids (`Machine.machineId`,
 * `Organization.organizationId`), which is what the filter inputs and the
 * customer route take; `organization.id` is the opaque node handle.
 */
export const insightRowFieldsFragment = graphql`
  fragment insightRowFields_insight on Insight @inline {
    id
    title
    type
    severity
    status
    snoozedUntil
    detectedAt
    machineId
    machine {
      nickname
      hostname
      displayName
      type
    }
    organizationId
    organization {
      id
      name
    }
  }
`;
