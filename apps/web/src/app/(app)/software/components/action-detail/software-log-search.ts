import { graphql, readInlineData } from 'react-relay';
import type { softwareLogSearch_device$key } from '@/__generated__/softwareLogSearch_device.graphql';
import { executionOutput } from '@/app/(app)/scripts/shared/utils/execution-helpers';
import { softwareActionStatusLabel } from '../action-list/software-action-status-tag';

/**
 * Everything a log row shows that the search box can match: the device, its customer, the output and the status.
 *
 * `@inline` because the consumer is `matchesSoftwareLog`, a plain predicate the table filters its rows with — not a
 * component.
 */
const softwareLogSearchFragment = graphql`
  fragment softwareLogSearch_device on SoftwareActionDevice @inline {
    machineId
    hostname
    organizationName
    status
    stdout
    stderr
    error
  }
`;

/**
 * Whether a row matches what the user typed. The run's device list comes whole, so the box works on what the rows
 * show.
 */
export function matchesSoftwareLog(ref: softwareLogSearch_device$key, needle: string): boolean {
  const { machineId, hostname, organizationName, status, stdout, stderr, error } = readInlineData(
    softwareLogSearchFragment,
    ref,
  );
  const fields = [
    hostname || machineId,
    organizationName,
    executionOutput({ stdout, stderr, error }),
    softwareActionStatusLabel(status),
  ];
  return fields.some(field => field?.toLowerCase().includes(needle));
}
