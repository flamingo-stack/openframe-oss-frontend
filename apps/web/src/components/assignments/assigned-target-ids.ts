import { ensureGlobalId } from './relay-id';
import { ASSIGNMENT_TARGET_TYPES, type AssignmentsValue, type ServerAssignmentTargetType } from './types';

/**
 * The `assigned…Ids` lists of an input that takes an item's assignments whole
 * (`CreateArticleInput`, `UpdateArticleInput`). There a list is what the item is
 * assigned to after the save, and a list left out is not touched.
 */
export interface AssignedTargetIds {
  assignedOrganizationIds?: string[];
  assignedDeviceIds?: string[];
  assignedTicketIds?: string[];
  assignedKnowledgeArticleIds?: string[];
}

const INPUT_FIELD = {
  ORGANIZATION: 'assignedOrganizationIds',
  DEVICE: 'assignedDeviceIds',
  TICKET: 'assignedTicketIds',
  KNOWLEDGE_ARTICLE: 'assignedKnowledgeArticleIds',
} as const satisfies Record<ServerAssignmentTargetType, keyof AssignedTargetIds>;

function targetIds(assignments: AssignmentsValue, targetType: ServerAssignmentTargetType): string[] {
  return (assignments[targetType] ?? []).map(ref => ensureGlobalId(targetType, ref.id));
}

/**
 * A form's assignments as those lists, global ids throughout. Only the lists
 * that differ from `stored` are in the answer: the form holds one page of what
 * is assigned and the server caps a list, so a kind nobody touched is left to
 * the server rather than written back.
 */
export function assignedTargetIds(
  assignments: AssignmentsValue | undefined,
  stored: AssignmentsValue | undefined = {},
): AssignedTargetIds {
  const lists: AssignedTargetIds = {};
  for (const targetType of ASSIGNMENT_TARGET_TYPES) {
    const next = targetIds(assignments ?? {}, targetType);
    const before = new Set(targetIds(stored, targetType));
    if (next.length !== before.size || next.some(id => !before.has(id))) {
      lists[INPUT_FIELD[targetType]] = next;
    }
  }
  return lists;
}
