import type { RadioGroupBlockOption } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SoftwareAction } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

export interface SoftwareActionCopy {
  /** The ACTION column, the first word of a log's STATUS, the start of a schedule's name. */
  verb: string;
  /** The Install / Update Software form. */
  formTitle: string;
  runLabel: string;
  scheduleLabel: string;
  modes: RadioGroupBlockOption[];
  started: string;
  scheduled: string;
  failed: string;
  /** One run's page, and the heading over its per-device logs. */
  detailTitle: string;
  logsHeading: string;
}

/** Everything the install and update flows word differently, on every page that shows one. */
export const SOFTWARE_ACTION_COPY: Record<SoftwareAction, SoftwareActionCopy> = {
  [SoftwareAction.INSTALL]: {
    verb: 'Install',
    formTitle: 'Install Software',
    runLabel: 'Run Installation',
    scheduleLabel: 'Schedule Install',
    modes: [
      { value: 'now', label: 'Install Now', description: 'The install starts immediately.' },
      {
        value: 'schedule',
        label: 'Schedule Install',
        description: 'The install runs automatically at the scheduled time.',
      },
    ],
    started: 'Installation started',
    scheduled: 'Installation scheduled',
    failed: 'Failed to start the installation',
    detailTitle: 'Software Install Details',
    logsHeading: 'Install Logs',
  },
  [SoftwareAction.UPDATE]: {
    verb: 'Update',
    formTitle: 'Update Software',
    runLabel: 'Run Update',
    scheduleLabel: 'Schedule Update',
    modes: [
      { value: 'now', label: 'Update Now', description: 'The update starts immediately.' },
      {
        value: 'schedule',
        label: 'Schedule Update',
        description: 'The update runs automatically at the scheduled time.',
      },
    ],
    started: 'Update started',
    scheduled: 'Update scheduled',
    failed: 'Failed to start the update',
    detailTitle: 'Software Update Details',
    logsHeading: 'Update Logs',
  },
};

/** A run's page title while the record has not said which action it is — or names one this build does not know. */
export const SOFTWARE_ACTION_DETAIL_TITLE = 'Software Action Details';

/** The copy for a run's `action` as the payload types it — undefined for an action this build does not know. */
export function softwareActionCopy(action: string): SoftwareActionCopy | undefined {
  return presentationFor(SOFTWARE_ACTION_COPY, action);
}
