import type { ScheduleDeviceCriteriaInput } from '@/__generated__/setScheduleDeviceCriteriaMutation.graphql';
import type { DeviceFilterInput } from '@/app/(app)/devices/types/device.types';
import { criteriaToInput, type ScheduleCriteria } from './schedule-criteria';

/**
 * The criteria dropdowns must offer the whole fleet's dimensions, never just
 * what the rule being written already matches — otherwise picking one customer
 * makes the second unpickable. Module-level so the query key stays stable.
 */
export const UNFILTERED: DeviceFilterInput = {};

/**
 * The editor holds `deviceTypes` as strings, the generated input wants the
 * `DeviceType` union. The values are taken from the `DeviceType` enum in
 * `@/generated/schema-enums` (see `ScheduleCriteriaFields`), so they are
 * members of it — relay-compiler just emits its own copy of the union per
 * operation.
 */
export function toRelayCriteria(criteria: ScheduleCriteria): ScheduleDeviceCriteriaInput {
  return criteriaToInput(criteria) as ScheduleDeviceCriteriaInput;
}
