import { SoftwareVersionStatus } from '@/generated/schema-enums';
import { OUTDATED_TAG } from './outdated-tag';

/** Every version status, as the funnel lists it — Outdated is the same word the row's chip uses. */
export const SOFTWARE_VERSION_STATUS_LABEL: Record<SoftwareVersionStatus, string> = {
  [SoftwareVersionStatus.UP_TO_DATE]: 'Up to date',
  [SoftwareVersionStatus.OUTDATED]: OUTDATED_TAG.label,
  [SoftwareVersionStatus.UNKNOWN]: 'Unknown',
};
