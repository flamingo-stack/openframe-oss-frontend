import { format } from 'date-fns';
import { ScheduleTimeReference } from '@/generated/schema-enums';

/**
 * The name a software schedule is created under. The backend refuses a second schedule with a name it already holds
 * (409), so the name carries the start besides what runs: two runs of one program at two times are two schedules, and
 * the clock it reads by tells apart a device-local 03:00 from the server's.
 */
export function softwareScheduleName(
  verb: string,
  names: readonly string[],
  start: Date,
  timeReference: ScheduleTimeReference,
): string {
  const at = format(start, 'yyyy-MM-dd HH:mm');
  const clock = timeReference === ScheduleTimeReference.DEVICE_LOCAL ? ' (device local)' : '';
  return `${verb} ${names.join(', ')}, ${at}${clock}`;
}
