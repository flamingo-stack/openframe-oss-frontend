import {
  BellSnoozeIcon,
  BoxArchiveIcon,
  CheckCircleIcon,
  EyeIcon,
  Refresh01LeftIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ActionsMenuItem } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ComponentType } from 'react';
import type { InsightStatus } from '@/generated/schema-enums';
import type { TransitionTarget } from '../hooks/use-incident-transitions';
import { INCIDENT_TRANSITION_ACTIONS, transitionsFrom } from '../utils/incident-labels';

const TRANSITION_ICON: Record<InsightStatus, ComponentType<{ className?: string }>> = {
  NEW: Refresh01LeftIcon,
  ACKNOWLEDGED: EyeIcon,
  SNOOZED: BellSnoozeIcon,
  RESOLVED: CheckCircleIcon,
  ARCHIVED: BoxArchiveIcon,
};

/**
 * The status-transition menu — one item per transition the backend allows
 * from the incident's status, so the menu never offers an action that would
 * come back as an error. Shared by the list's row menu and the detail header.
 */
export function transitionMenuItems(
  incident: TransitionTarget & { status: string },
  transition: (target: TransitionTarget, status: InsightStatus) => void,
  disabled: boolean,
): ActionsMenuItem[] {
  return transitionsFrom(incident.status).map(status => {
    const Icon = TRANSITION_ICON[status];
    return {
      id: `transition-${status}`,
      label: INCIDENT_TRANSITION_ACTIONS[status].label,
      icon: <Icon className="size-6 text-ods-text-secondary" />,
      disabled,
      onClick: () => transition(incident, status),
    };
  });
}
