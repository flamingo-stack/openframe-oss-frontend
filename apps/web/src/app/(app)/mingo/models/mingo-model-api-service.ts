import { commitMutation, fetchQuery } from 'react-relay';
import { Environment, type GraphQLResponse, Network, RecordSource, Store } from 'relay-runtime';
import readQuery, {
  type mingoModelOperationsReadQuery,
} from '@/chat/__generated__/mingoModelOperationsReadQuery.graphql';
import updateMutation, {
  type mingoModelOperationsUpdateMutation,
} from '@/chat/__generated__/mingoModelOperationsUpdateMutation.graphql';
import { AgentType, DialogStatus, DialogStreamState } from '@/generated/chat-schema-enums';
import { AIProvider } from '@/generated/schema-enums';
import { apiClient } from '@/lib/api-client';
import type { DialogModel, DialogModelInput, MingoModelRecord } from './mingo-model.types';

const AGENT_TYPES = Object.values(AgentType);
const MODEL_PROVIDERS = Object.values(AIProvider);
const DIALOG_STATUSES = Object.values(DialogStatus);
const DIALOG_STREAM_STATES = Object.values(DialogStreamState);

/** Reads the chat API through Relay using the application's existing session and request handling. */
function chatEnvironment(): Environment {
  return new Environment({
    network: Network.create(async (request, variables) => {
      const response = await apiClient.post<GraphQLResponse>('/chat/graphql', { query: request.text, variables });
      if (!response.ok) throw new Error(response.error || 'Could not reach the chat service');
      if (!response.data) throw new Error('The chat service returned no data');
      return response.data;
    }),
    store: new Store(new RecordSource()),
  });
}

type WireModel = NonNullable<mingoModelOperationsReadQuery['response']['dialog']>['effectiveModel'];

function knownValue<T extends string>(value: string, allowed: readonly T[], name: string): T {
  const known = allowed.find(candidate => candidate === value);
  if (known === undefined) throw new Error(`The chat service returned an unsupported ${name}`);
  return known;
}

function modelOf(model: WireModel): DialogModel {
  return {
    provider: knownValue(model.provider, MODEL_PROVIDERS, 'model provider'),
    modelName: model.modelName,
    displayName: model.displayName ?? null,
  };
}

function recordOf(dialog: mingoModelOperationsReadQuery['response']['dialog']): MingoModelRecord {
  if (!dialog) throw new Error('This chat is not available');
  return {
    id: dialog.id,
    dialogId: dialog.dialogId,
    agentType: dialog.agentType ? knownValue(dialog.agentType, AGENT_TYPES, 'agent type') : null,
    status: knownValue(dialog.status, DIALOG_STATUSES, 'chat status'),
    streamState: knownValue(dialog.streamState, DIALOG_STREAM_STATES, 'stream state'),
    pendingApproval: dialog.pendingApproval ?? null,
    contextSize: dialog.modelTokenBudget,
    model: dialog.model ? modelOf(dialog.model) : null,
    effectiveModel: modelOf(dialog.effectiveModel),
  };
}

export async function readDialogModel(id: string): Promise<MingoModelRecord> {
  const response = await fetchQuery<mingoModelOperationsReadQuery>(
    chatEnvironment(),
    readQuery,
    { id },
    { fetchPolicy: 'network-only' },
  ).toPromise();
  if (!response) throw new Error('The chat service returned no data');
  return recordOf(response.dialog);
}

export function updateDialogModel(id: string, model: DialogModelInput | null): Promise<MingoModelRecord> {
  return new Promise<mingoModelOperationsUpdateMutation['response']>((resolve, reject) => {
    commitMutation<mingoModelOperationsUpdateMutation>(chatEnvironment(), {
      mutation: updateMutation,
      variables: { input: { id, model: model ? { provider: model.provider, modelName: model.modelName } : null } },
      onCompleted: (response, errors) => {
        const error = errors?.[0]?.message ?? response.updateDialogModel.userErrors[0]?.message;
        if (error) reject(new Error(error));
        else resolve(response);
      },
      onError: reject,
    });
  }).then(response => recordOf(response.updateDialogModel.dialog));
}
