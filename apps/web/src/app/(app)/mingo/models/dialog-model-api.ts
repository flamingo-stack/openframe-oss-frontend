import { type MingoUserErrors, throwOnUserErrors } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type { AIProvider } from '@/generated/schema-enums';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '../../tickets/constants';
import { extractGraphQlData, type GraphQlResponse } from '../../tickets/utils/graphql';

/** A model a chat can be pinned to: what `createDialog` and `updateDialogModel` take. */
export interface DialogModelChoice {
  provider: AIProvider;
  modelName: string;
}

export interface DialogModel extends DialogModelChoice {
  displayName: string | null;
}

/** One chat's model: the one picked for it (null = the tenant default), the one that answers, and its context. */
export interface DialogModelState {
  model: DialogModel | null;
  effectiveModel: DialogModel;
  /** Null until the server says (a chat just created from a draft holds its pick before the first read). */
  modelTokenBudget: number | null;
}

const DIALOG_MODEL_FIELDS = `
  model { provider modelName displayName }
  effectiveModel { provider modelName displayName }
  modelTokenBudget
`;

const GET_DIALOG_MODEL_QUERY = `
  query GetDialogModel($id: ID!) {
    dialog(id: $id) { ${DIALOG_MODEL_FIELDS} }
  }
`;

const UPDATE_DIALOG_MODEL_MUTATION = `
  mutation UpdateDialogModel($input: UpdateDialogModelInput!) {
    updateDialogModel(input: $input) {
      dialog { ${DIALOG_MODEL_FIELDS} }
      userErrors { field message }
    }
  }
`;

export const dialogModelQueryKey = (dialogId: string) => ['mingo-dialog-model', dialogId] as const;

export async function fetchDialogModel(dialogId: string): Promise<DialogModelState> {
  const response = await apiClient.post<GraphQlResponse<{ dialog: DialogModelState | null }>>(API_ENDPOINTS.GRAPHQL, {
    query: GET_DIALOG_MODEL_QUERY,
    variables: { id: dialogId },
  });
  const { dialog } = extractGraphQlData(response);
  if (!dialog) throw new Error('This chat is not available');
  return dialog;
}

/** `null` puts the chat back on the tenant default. */
export async function updateDialogModel(dialogId: string, model: DialogModelChoice | null): Promise<DialogModelState> {
  const response = await apiClient.post<
    GraphQlResponse<{ updateDialogModel: MingoUserErrors & { dialog: DialogModelState | null } }>
  >(API_ENDPOINTS.GRAPHQL, {
    query: UPDATE_DIALOG_MODEL_MUTATION,
    variables: { input: { id: dialogId, model: model && { provider: model.provider, modelName: model.modelName } } },
  });
  const payload = extractGraphQlData(response).updateDialogModel;
  throwOnUserErrors(payload);
  if (!payload.dialog) throw new Error('This chat is not available');
  return payload.dialog;
}
