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
 * refuses an empty setting. `onWritten` refetches the list, since `InsightCheck` has no id for the
 * store to merge an answer into, and a write at one scope moves what the others inherit.
 */
export function useIncidentCheckMutations(scope: CheckScope, onWritten: () => void) {
  const { toast } = useToast();
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateInsightCheckSettingMutation);
  const [commitReset, isResetting] = useMutation<ResetMutationType>(resetInsightCheckSettingMutation);
  // The check a write is on its way for: its row locks until the answer.
  const [pendingCheck, setPendingCheck] = useState<string | null>(null);

  const onError = (error: Error) => {
    setPendingCheck(null);
    toast({
      title: 'Error',
      description: getRelayErrorMessage(error, "Couldn't save the check"),
      variant: 'destructive',
    });
  };

  const onCompleted =
    (target: SaveTarget, { successDescription, onSaved }: SaveOptions) =>
    () => {
      setPendingCheck(null);
      toast({ title: `${target.name} saved`, description: successDescription, variant: 'success' });
      onSaved?.();
      onWritten();
    };

  const reset = (target: SaveTarget, options: SaveOptions) => {
    setPendingCheck(target.check);
    commitReset({
      variables: { input: { check: target.check, ...scopeInput(scope) } },
      onCompleted: onCompleted(target, options),
      onError,
    });
  };

  const save = (target: SaveTarget, draft: CheckSettingDraft, options: SaveOptions) => {
    if (isEmptyDraft(draft)) {
      reset(target, options);
      return;
    }
    setPendingCheck(target.check);
    commitUpdate({
      variables: { input: toUpdateInput(target.check, scope, draft) },
      onCompleted: onCompleted(target, options),
      onError,
    });
  };

  const isSaving = isUpdating || isResetting;
  return { save, reset, isSaving, pendingCheck: isSaving ? pendingCheck : null };
}
