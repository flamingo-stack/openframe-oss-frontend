import { graphql, readInlineData } from 'react-relay';
import type { softwareLogSearch_execution$key } from '@/__generated__/softwareLogSearch_execution.graphql';
import { customerContactEmail } from '@/app/(app)/customers/utils/customer-contact-email';
import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
import { executionOutput } from '@/app/(app)/scripts/shared/utils/execution-helpers';
import { softwareRunStatusLabel } from './software-run-status';

/**
 * Everything a log row shows that the search box can match: the device, its
 * customer and contact, the output and the status.
 *
 * `@inline` because the consumer is `matchesSoftwareLog`, a plain predicate the
 * table filters its loaded rows with — not a component.
 */
const softwareLogSearchFragment = graphql`
  fragment softwareLogSearch_execution on ScriptExecution @inline {
    status
    stdout
    stderr
    error
    machine {
      nickname
      displayName
      hostname
      organization {
        name
        contactInformation {
          contacts {
            email
          }
        }
      }
    }
  }
`;

/**
 * Whether a row matches what the user typed. The logs query's own `search` is
 * spent on the run's executionId (see `SoftwareLogsTable`), so the box works on
 * what the rows show — and, since an empty result keeps the infinite-scroll
 * sentinel mounted, converges on the whole run.
 */
export function matchesSoftwareLog(ref: softwareLogSearch_execution$key, needle: string): boolean {
  const { status, stdout, stderr, error, machine } = readInlineData(softwareLogSearchFragment, ref);
  const organization = machine?.organization;
  const fields = [
    getDeviceName({ nickname: machine?.nickname, displayName: machine?.displayName, hostname: machine?.hostname }),
    organization?.name,
    customerContactEmail(organization?.contactInformation?.contacts?.map(contact => contact?.email)),
    executionOutput({ stdout, stderr, error }),
    softwareRunStatusLabel(status),
  ];
  return fields.some(field => field?.toLowerCase().includes(needle));
}
