/** The server's `AssignmentTargetType` — what `assignedItems` is queried for and `assignItem` accepts. */
export type ServerAssignmentTargetType = 'ORGANIZATION' | 'DEVICE' | 'TICKET' | 'KNOWLEDGE_ARTICLE';

/**
 * What an item can be assigned TO, as a form may render it. INSIGHT is
 * client-only — the server links a ticket to the incident it is filed from in
 * the other direction (item INSIGHT → target TICKET, via
 * `CreateTicketInput.insightId`), so on the ticket form the incident is a row
 * that is shown and sent as `insightId`, never assigned through `assignItem`.
 * Hence `ASSIGNMENT_TARGET_TYPES` (the server list) vs
 * `ALL_ASSIGNMENT_TARGET_TYPES` (what a form may render).
 */
export type AssignmentTargetType = ServerAssignmentTargetType | 'INSIGHT';

/** What can own assignments — the server's `AssignmentItemType`. */
export type AssignmentItemType = 'TICKET' | 'KNOWLEDGE_ARTICLE' | 'INSIGHT';

export interface AssignmentRef {
  id: string;
  label: string;
}

export type AssignmentsValue = Partial<Record<AssignmentTargetType, AssignmentRef[]>>;

/** The targets the server reads and writes — what `assignedItems` is queried for and `assignItem` accepts. */
export const ASSIGNMENT_TARGET_TYPES: ReadonlyArray<ServerAssignmentTargetType> = [
  'ORGANIZATION',
  'DEVICE',
  'TICKET',
  'KNOWLEDGE_ARTICLE',
];

/** Every target a form may render, the client-only INSIGHT included. */
export const ALL_ASSIGNMENT_TARGET_TYPES: ReadonlyArray<AssignmentTargetType> = [...ASSIGNMENT_TARGET_TYPES, 'INSIGHT'];
