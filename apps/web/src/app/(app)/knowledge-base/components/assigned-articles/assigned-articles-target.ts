import { AssignmentTargetType } from '@/generated/schema-enums';
import { toGlobalId } from '@/lib/relay-id';

/**
 * The customer or device whose articles a tab lists: the `AssignmentTargetInput`
 * of `knowledgeBaseItems(filter: { assignedTo })` and `knowledgeBaseTags(assignedTo:)`,
 * and the target half of `assignItem` / `unassignItem`.
 *
 * `targetId` is a global id. The server stores an assignment by the target's own id
 * (an `organizationId`, a `machineId`) and the Organization / Machine global ids
 * encode exactly that, so the pages build it from the id they already hold.
 */
export interface AssignedArticlesTarget {
  readonly targetType: typeof AssignmentTargetType.ORGANIZATION | typeof AssignmentTargetType.DEVICE;
  readonly targetId: string;
}

export function customerArticlesTarget(organizationId: string): AssignedArticlesTarget {
  return { targetType: AssignmentTargetType.ORGANIZATION, targetId: toGlobalId('Organization', organizationId) };
}

export function deviceArticlesTarget(machineId: string): AssignedArticlesTarget {
  return { targetType: AssignmentTargetType.DEVICE, targetId: toGlobalId('Machine', machineId) };
}

/** What the empty state calls the target. */
export function targetNoun(target: AssignedArticlesTarget): string {
  return target.targetType === AssignmentTargetType.ORGANIZATION ? 'customer' : 'device';
}
