'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useState } from 'react';
import { useMutation } from 'react-relay';
import type { resetInsightCheckSettingMutation as ResetMutationType } from '@/__generated__/resetInsightCheckSettingMutation.graphql';
import type { updateInsightCheckSettingMutation as UpdateMutationType } from '@/__generated__/updateInsightCheckSettingMutation.graphql';
import { resetInsightCheckSettingMutation } from '@/graphql/insights/reset-insight-check-setting-mutation';
import { updateInsightCheckSettingMutation } from '@/graphql/insights/update-insight-check-setting-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import {
  type CheckScope,
  type CheckSettingDraft,
  isEmptyDraft,
  scopeInput,
  toUpdateInput,
} from '../utils/incident-check-transform';

interface SaveTarget {
  check: string;
  /** The check's name, for the toast. */
  name: string;
}

interface SaveOptions {
  /** The toast's line on success. */
  successDescription: string;
  onSaved?: () => void;
}

/**
 * The two writes of the Checks tab. A draft that stores nothing is sent as a reset: the update
 * refuses an empty setting. Each answer is the check at this scope under the list's own id, so the
 * row updates from the store; other scopes' lists refetch when they are opened (`store-and-network`).
 */
export function useIncidentCheckMutations(scope: CheckScope) {
  const { toast } = useToast();
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateInsightCheckSettingMutation);
  const [commitReset, isResetting] = useMutation<ResetMutationType>(resetInsightCheckSettingMutation);
  // The checks a write is on its way for: each row locks until its own answer, whatever answers first.
  const [pendingChecks, setPendingChecks] = useState<ReadonlySet<string>>(() => new Set());
  const markPending = (check: string, pending: boolean) =>
    setPendingChecks(current => {
      const next = new Set(current);
      if (pending) next.add(check);
      else next.delete(check);
      return next;
    });

  const onError = (target: SaveTarget) => (error: Error) => {
    markPending(target.check, false);
    toast({
      title: 'Error',
      description: getRelayErrorMessage(error, "Couldn't save the check"),
      variant: 'destructive',
    });
  };

  const onCompleted =
    (target: SaveTarget, { successDescription, onSaved }: SaveOptions) =>
    () => {
      markPending(target.check, false);
      toast({ title: `${target.name} saved`, description: successDescription, variant: 'success' });
      onSaved?.();
    };

  const reset = (target: SaveTarget, options: SaveOptions) => {
    markPending(target.check, true);
    commitReset({
      variables: { input: { check: target.check, ...scopeInput(scope) } },
      onCompleted: onCompleted(target, options),
      onError: onError(target),
    });
  };

  const save = (target: SaveTarget, draft: CheckSettingDraft, options: SaveOptions) => {
    if (isEmptyDraft(draft)) {
      reset(target, options);
      return;
    }
    markPending(target.check, true);
    commitUpdate({
      variables: { input: toUpdateInput(target.check, scope, draft) },
      onCompleted: onCompleted(target, options),
      onError: onError(target),
    });
  };

  const isSaving = isUpdating || isResetting;
  return { save, reset, isSaving, isPending: (check: string) => pendingChecks.has(check) };
}
