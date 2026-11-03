import type { NotificationEntityType } from '@/generated/schema-enums';

const ENTITY_KIND: Record<NotificationEntityType, string> = {
  DEVICE: 'Device',
  INSIGHT: 'Incident',
  TICKET: 'Ticket',
  DIALOG: 'Chat',
};

/** The scope's chip: what the list is narrowed to, by name when the link carried one. */
export function entityScopeLabel(type: NotificationEntityType, name: string): string {
  const kind = ENTITY_KIND[type];
  return name ? `${kind}: ${name}` : kind;
}
