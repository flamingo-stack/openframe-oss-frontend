'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { fetchQuery, useMutation, useRelayEnvironment } from 'react-relay';
import type { resetInsightCheckOverridesMutation as ResetOverridesMutationType } from '@/__generated__/resetInsightCheckOverridesMutation.graphql';
import type { resetInsightCheckSettingMutation as ResetMutationType } from '@/__generated__/resetInsightCheckSettingMutation.graphql';
import type { updateInsightCheckSettingMutation as UpdateMutationType } from '@/__generated__/updateInsightCheckSettingMutation.graphql';
import { insightCheckPageQuery } from '@/graphql/insights/insight-check-page-query';
import { insightChecksListQuery } from '@/graphql/insights/insight-checks-list-query';
import { resetInsightCheckOverridesMutation } from '@/graphql/insights/reset-insight-check-overrides-mutation';
import { resetInsightCheckSettingMutation } from '@/graphql/insights/reset-insight-check-setting-mutation';
import { updateInsightCheckSettingMutation } from '@/graphql/insights/update-insight-check-setting-mutation';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import {
  type CheckScope,
  type CheckSettingDraft,
  isEmptyDraft,
  scopeInput,
  toUpdateInput,
} from '../utils/check-transform';

/** Every write applies from the check's next run on each device. */
export const NEXT_RUN_NOTE = 'Applies on the next run of the check.';

interface WriteOptions {
  /** The toast on success: its title, and the line under it (the next-run note unless given). */
  title: string;
  description?: string;
  onDone?: () => void;
}

/**
 * The writes of the Checks list and a check's page. A draft that stores nothing is sent as a reset:
 * the update refuses an empty setting. An answer at GLOBAL updates the check in the store by itself;
 * an override's answer is the check at that customer, tag or device, so after every write the
 * check's page and the list are read again, and its override table and count follow.
 */
export function useCheckMutations() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateInsightCheckSettingMutation);
  const [commitReset, isResetting] = useMutation<ResetMutationType>(resetInsightCheckSettingMutation);
  const [commitResetOverrides, isResettingOverrides] = useMutation<ResetOverridesMutationType>(
    resetInsightCheckOverridesMutation,
  );

  const refresh = (check: string) => {
    fetchQuery(environment, insightCheckPageQuery, { check }, { fetchPolicy: 'network-only' }).subscribe({});
    fetchQuery(environment, insightChecksListQuery, {}, { fetchPolicy: 'network-only' }).subscribe({});
  };

  const handlers = (check: string, { title, description = NEXT_RUN_NOTE, onDone }: WriteOptions) => ({
    onCompleted: () => {
      refresh(check);
      toast({ title, description, variant: 'success' });
      onDone?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: getRelayErrorMessage(error, "Couldn't save the check"),
        variant: 'destructive',
      });
    },
  });

  const reset = (check: string, scope: CheckScope, options: WriteOptions) => {
    commitReset({ variables: { input: { check, ...scopeInput(scope) } }, ...handlers(check, options) });
  };

  const save = (check: string, scope: CheckScope, draft: CheckSettingDraft, options: WriteOptions) => {
    if (isEmptyDraft(draft)) {
      reset(check, scope, options);
      return;
    }
    commitUpdate({ variables: { input: toUpdateInput(check, scope, draft) }, ...handlers(check, options) });
  };

  const deleteAllOverrides = (check: string, options: WriteOptions) => {
    commitResetOverrides({ variables: { input: { check } }, ...handlers(check, options) });
  };

  return { save, reset, deleteAllOverrides, isSaving: isUpdating || isResetting || isResettingOverrides };
}
