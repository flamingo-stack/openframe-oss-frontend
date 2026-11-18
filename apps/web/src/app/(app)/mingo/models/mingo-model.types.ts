import type { AgentType, DialogStatus, DialogStreamState } from '@/generated/chat-schema-enums';
import type { AIProvider } from '@/generated/schema-enums';

export interface DialogModelInput {
  provider: AIProvider;
  modelName: string;
}

export interface DialogModel extends DialogModelInput {
  displayName: string | null;
}

export interface MingoModelRecord {
  id: string;
  dialogId: string;
  agentType: AgentType | null;
  model: DialogModel | null;
  effectiveModel: DialogModel;
  status: DialogStatus;
  streamState: DialogStreamState;
  pendingApproval: { id: string } | null;
  contextSize: number;
}
