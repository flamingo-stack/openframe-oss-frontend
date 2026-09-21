import {
  AlertTriangleIcon,
  FileContentIcon,
  IdCardIcon,
  MonitorIcon,
  TagIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ComponentType, SVGProps } from 'react';
import type { AssignmentTargetType } from './types';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  className?: string;
  size?: number;
  color?: string;
}

export interface TargetMeta {
  rowLabel: string;
  menuLabel: string;
  tabLabel: string;
  icon: ComponentType<IconProps>;
  /**
   * The row can be added from the "Assign Item" menu and its picker searched.
   * INSIGHT is not: a ticket is linked to ONE incident by being filed from it,
   * so the row only ever shows what the page arrived with (and can be dropped).
   */
  pickable: boolean;
}

export const TARGET_CONFIG: Record<AssignmentTargetType, TargetMeta> = {
  ORGANIZATION: {
    rowLabel: 'Assigned Customers',
    menuLabel: 'Customer',
    tabLabel: 'Customers',
    icon: IdCardIcon,
    pickable: true,
  },
  DEVICE: { rowLabel: 'Assigned Devices', menuLabel: 'Device', tabLabel: 'Devices', icon: MonitorIcon, pickable: true },
  TICKET: { rowLabel: 'Assigned Tickets', menuLabel: 'Ticket', tabLabel: 'Tickets', icon: TagIcon, pickable: true },
  KNOWLEDGE_ARTICLE: {
    rowLabel: 'Assigned Knowledge Articles',
    menuLabel: 'Knowledge Article',
    tabLabel: 'Knowledge Articles',
    icon: FileContentIcon,
    pickable: true,
  },
  INSIGHT: {
    rowLabel: 'Assigned Incident',
    menuLabel: 'Incident',
    tabLabel: 'Incidents',
    icon: AlertTriangleIcon,
    pickable: false,
  },
};
