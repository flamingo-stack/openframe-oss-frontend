'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postGraphQl } from './graphql';
import { ensureGlobalId } from './relay-id';
import { ASSIGNMENT_TARGET_TYPES, type AssignmentItemType, type AssignmentsValue } from './types';

const ASSIGN_ITEM_MUTATION = `#graphql
  mutation AssignmentsAssignItem(
    $itemId: ID!
    $itemType: AssignmentItemType!
    $targetType: AssignmentTargetType!
    $targetId: ID!
  ) {
    assignItem(itemId: $itemId, itemType: $itemType, targetType: $targetType, targetId: $targetId) { id }
  }
`;

const UNASSIGN_ITEM_MUTATION = `#graphql
  mutation AssignmentsUnassignItem($itemId: ID!, $targetType: AssignmentTargetType!, $targetId: ID!) {
    unassignItem(itemId: $itemId, targetType: $targetType, targetId: $targetId)
  }
`;

interface ApplyAssignmentsDiffInput {
  itemId: string;
  itemType: AssignmentItemType;
  prev: AssignmentsValue;
  next: AssignmentsValue;
}

async function applyAssignmentsDiff({ itemId, itemType, prev, next }: ApplyAssignmentsDiffInput): Promise<void> {
  const normalizedItemId = ensureGlobalId(itemType, itemId);
  const tasks: Promise<unknown>[] = [];

  for (const targetType of ASSIGNMENT_TARGET_TYPES) {
    const prevIds = new Set((prev[targetType] ?? []).map(ref => ref.id));
    const nextIds = new Set((next[targetType] ?? []).map(ref => ref.id));

    for (const id of nextIds) {
      if (!prevIds.has(id)) {
        tasks.push(
          postGraphQl(ASSIGN_ITEM_MUTATION, {
            itemId: normalizedItemId,
            itemType,
            targetType,
            targetId: ensureGlobalId(targetType, id),
          }),
        );
      }
    }
    for (const id of prevIds) {
      if (!nextIds.has(id)) {
        tasks.push(
          postGraphQl(UNASSIGN_ITEM_MUTATION, {
            itemId: normalizedItemId,
            targetType,
            targetId: ensureGlobalId(targetType, id),
          }),
        );
      }
    }
  }

  await Promise.all(tasks);
}

export function useApplyAssignmentsDiff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyAssignmentsDiff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', 'assigned-items'] });
    },
    // The forms that await this catch to keep the rejection from going unhandled
    // and rely on each mutation to report itself — without this the assignments
    // half of a save failed silently.
    onError: err => {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update assignments',
        variant: 'destructive',
      });
    },
  });
}
