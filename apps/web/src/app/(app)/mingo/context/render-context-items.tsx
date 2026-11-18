'use client';

import { OPENFRAME_RECORD_KIND } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
/**
 * Dispatcher wired into `ChatContextPickerConfig.renderItems`. Maps the active
 * entity type to its per-type items component (which owns data via its own
 * hooks). The lib calls this INSIDE its `<Suspense>` + error boundary, so the
 * returned component may suspend on initial load.
 *
 * Must return a JSX ELEMENT (not call the component as a function) so the
 * component's hooks run correctly; `key={type}` remounts on type switch so each
 * type's hook state is isolated.
 */
import type { ContextItemsRenderArgs } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { ReactNode } from 'react';
import type { ContextItemsProps } from './items-shared';
import {
  DeviceItems,
  IncidentItems,
  KnowledgeBaseFolderItems,
  KnowledgeBaseItems,
  OrganizationItems,
  ScheduleItems,
  ScriptItems,
  SoftwareItems,
  UserItems,
  VulnerabilityItems,
} from './relay-items';
import { PolicyItems, QueryItems, TicketItems } from './rest-items';

const COMPONENTS: Record<string, (p: ContextItemsProps) => ReactNode> = {
  [OPENFRAME_RECORD_KIND.DEVICE]: DeviceItems,
  [OPENFRAME_RECORD_KIND.ORGANIZATION]: OrganizationItems,
  [OPENFRAME_RECORD_KIND.KB_ARTICLE]: KnowledgeBaseItems,
  [OPENFRAME_RECORD_KIND.KB_FOLDER]: KnowledgeBaseFolderItems,
  [OPENFRAME_RECORD_KIND.TICKET]: TicketItems,
  [OPENFRAME_RECORD_KIND.POLICY]: PolicyItems,
  [OPENFRAME_RECORD_KIND.QUERY]: QueryItems,
  [OPENFRAME_RECORD_KIND.USER]: UserItems,
  [OPENFRAME_RECORD_KIND.SCRIPT]: ScriptItems,
  [OPENFRAME_RECORD_KIND.SCHEDULED_SCRIPT]: ScheduleItems,
  [OPENFRAME_RECORD_KIND.INSIGHT]: IncidentItems,
  [OPENFRAME_RECORD_KIND.SOFTWARE]: SoftwareItems,
  [OPENFRAME_RECORD_KIND.VULNERABILITY]: VulnerabilityItems,
};

export function renderMingoContextItems({
  type,
  query,
  selectedKeys,
  onToggle,
  atLimit,
}: ContextItemsRenderArgs): ReactNode {
  const Component = COMPONENTS[type];
  if (!Component) return null;
  return <Component key={type} query={query} selectedKeys={selectedKeys} onToggle={onToggle} atLimit={atLimit} />;
}
