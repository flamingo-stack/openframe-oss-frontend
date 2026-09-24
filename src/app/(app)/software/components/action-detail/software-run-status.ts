import { ScriptExecutionStatus } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

/**
 * One device's run, labelled the way the software designs read it: a finished
 * run is "Success", where the script lists say "Completed".
 */
const SOFTWARE_RUN_STATUS_LABEL = {
  [ScriptExecutionStatus.QUEUED]: 'Queued',
  [ScriptExecutionStatus.RUNNING]: 'Running',
  [ScriptExecutionStatus.SUCCESS]: 'Success',
  [ScriptExecutionStatus.FAILED]: 'Failed',
} satisfies Record<ScriptExecutionStatus, string>;

export function softwareRunStatusLabel(status: string): string {
  return presentationFor(SOFTWARE_RUN_STATUS_LABEL, status) ?? status;
}
