import { graphql } from 'react-relay';

/**
 * Step 2 of the device field ladder — a row plus what the core lib's
 * `DeviceSelector` shows beyond it: the hardware identifiers and the customer's
 * contact email.
 *
 * Used by the schedule's device picker (`schedule-device-picker-relay.ts`),
 * which lists the fleet rather than one schedule's assignments, so it can afford
 * the extra `organization.contactInformation` hop that [deviceRowFields_machine]
 * deliberately leaves out.
 */
export const deviceSelectorFieldsFragment = graphql`
  fragment deviceSelectorFields_machine on Machine @inline {
    ...deviceRowFields_machine
    manufacturer
    model
    serialNumber
    # A second selection on organization — different sub-fields than the row
    # step takes, so the two never have to be reassembled: the row reads name and
    # logo off its own data, this step reads the contact off its own.
    organization {
      contactInformation {
        contacts {
          email
        }
      }
    }
  }
`;
