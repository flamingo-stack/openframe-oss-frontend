'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { fetchQuery, graphql, useMutation, useRelayEnvironment } from 'react-relay';
import type { useCheckMutationsRefreshQuery as RefreshQueryType } from '@/__generated__/useCheckMutationsRefreshQuery.graphql';
import type { useCheckMutationsResetMutation as ResetMutationType } from '@/__generated__/useCheckMutationsResetMutation.graphql';
import type { useCheckMutationsResetOverridesMutation as ResetOverridesMutationType } from '@/__generated__/useCheckMutationsResetOverridesMutation.graphql';
import type { useCheckMutationsUpdateMutation as UpdateMutationType } from '@/__generated__/useCheckMutationsUpdateMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { NEXT_RUN_NOTE } from '../utils/check-messages';
import {
  type CheckScope,
  type CheckSettingDraft,
  isEmptyDraft,
  scopeInput,
  toUpdateInput,
} from '../utils/check-transform';

const updateMutation = graphql`
  mutation useCheckMutationsUpdateMutation($input: UpdateInsightCheckSettingInput!) {
    updateInsightCheckSetting(input: $input) {
      ...checkTransform_insightCheck
    }
  }
`;

const resetMutation = graphql`
  mutation useCheckMutationsResetMutation($input: ResetInsightCheckSettingInput!) {
    resetInsightCheckSetting(input: $input) {
      ...checkTransform_insightCheck
    }
  }
`;

const resetOverridesMutation = graphql`
  mutation useCheckMutationsResetOverridesMutation($input: ResetInsightCheckOverridesInput!) {
    resetInsightCheckOverrides(input: $input) {
      ...checkTransform_withOverrides
    }
  }
`;

/**
 * What a write changes besides the record it answers: the check's exceptions and the list's rows. The same fields
 * as the check page and the list read, so both draw the answer from the store.
 */
const refreshQuery = graphql`
  query useCheckMutationsRefreshQuery($check: String!) {
    insightCheck(check: $check) {
      ...checkTransform_withOverrides
    }
    insightChecks(scopeType: GLOBAL) {
      ...checkTransform_insightCheck
    }
  }
`;

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
 * check and the list are read again, and the exceptions table and count follow.
 */
export function useCheckMutations() {
  const { toast } = useToast();
  const environment = useRelayEnvironment();
  const [commitUpdate, isUpdating] = useMutation<UpdateMutationType>(updateMutation);
  const [commitReset, isResetting] = useMutation<ResetMutationType>(resetMutation);
  const [commitResetOverrides, isResettingOverrides] = useMutation<ResetOverridesMutationType>(resetOverridesMutation);

  const handlers = (check: string, { title, description = NEXT_RUN_NOTE, onDone }: WriteOptions) => ({
    onCompleted: () => {
      fetchQuery<RefreshQueryType>(environment, refreshQuery, { check }, { fetchPolicy: 'network-only' }).subscribe({});
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

export type CheckMutations = ReturnType<typeof useCheckMutations>;
