/**
 * View-models for the AI settings two-collection model (keep in sync with
 * ai-settings.graphqls):
 *  - AgentAiConfig — AI logic, tenant-wide per agent (CLIENT / ADMIN).
 *  - ClientView    — the client assistant's appearance (tenant-default + per-org override).
 */

import type { AIProvider } from '@/generated/schema-enums';

export type { AIProvider };
export type ApplicationTheme = 'DARK' | 'LIGHT' | 'SYSTEM';
export type AnswerStyle = 'SHORT' | 'STANDARD' | 'DETAILED' | 'CUSTOM';

/** Which assistant a config belongs to. CLIENT = customer-facing (Fae), ADMIN = Mingo. */
export type AgentType = 'CLIENT' | 'ADMIN';

export interface AiImage {
  id?: string;
  imageUrl: string;
  hash?: string;
}

export interface AiQuickAction {
  id: string;
  name: string;
  instructions: string;
  /**
   * Optional glyph, rendered on the chat chip and in the settings lists.
   * `iconName` is a library glyph key (the core-lib icon registry): Product Hub
   * defaults carry it, and tenant customs persist the one picked in the
   * editor. `iconUrl` / `iconProps` (uploaded image, glyph prop overrides such
   * as a color) come from the hub only; the tenant editor never writes them.
   */
  iconName?: string | null;
  iconUrl?: string | null;
  iconProps?: Record<string, unknown> | null;
}

export interface AiQuickActionInput {
  id?: string;
  name: string;
  instructions: string;
  /** Library glyph key from the editor's picker; null / blank clears it (the BE trims and stores null). */
  iconName?: string | null;
}

/** AI logic for one agent, tenant-wide (no per-organization override). */
export interface AgentAiConfig {
  id: string;
  agentType: AgentType;
  llmProvider: AIProvider;
  providerModel: string;
  answerStyle: AnswerStyle | null;
  customPrompt: string | null;
  /** True → `quickActions` are the OpenFrame defaults (Product Hub, BE-resolved); false → org customs. */
  quickActionsIsDefault: boolean;
  quickActions: AiQuickAction[];
  createdAt: string;
  updatedAt: string | null;
}

/** AI logic input. The target agent (CLIENT/ADMIN) is chosen by the mutation, not this input. */
export interface AgentAiConfigInput {
  llmProvider?: AIProvider;
  providerModel?: string;
  answerStyle?: AnswerStyle;
  customPrompt?: string;
  quickActionsIsDefault?: boolean;
  quickActions?: AiQuickActionInput[];
}

/** Client assistant appearance. `organizationId === null` is the tenant-wide default. */
export interface ClientView {
  id: string;
  organizationId: string | null;
  assistantName: string;
  assistantAvatar: AiImage | null;
  accentColor: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ClientViewInput {
  assistantName?: string;
  /** No longer configurable: sent only when a save creates the view (see `withClientViewCreateFields`). */
  applicationTheme?: ApplicationTheme;
  accentColor?: string;
}

/**
 * Fallbacks used when the backend has no record yet (query returns null). The
 * empty `id` signals "not persisted" — the first save creates it.
 */
export function getDefaultAgentAiConfig(agentType: AgentType): AgentAiConfig {
  return {
    id: '',
    agentType,
    llmProvider: 'ANTHROPIC',
    providerModel: '',
    answerStyle: 'STANDARD',
    customPrompt: null,
    quickActionsIsDefault: true,
    quickActions: [],
    createdAt: '',
    updatedAt: null,
  };
}

export function getDefaultClientView(organizationId: string | null = null): ClientView {
  return {
    id: '',
    organizationId,
    assistantName: 'AI',
    assistantAvatar: null,
    accentColor: '#F357BB',
    createdAt: '',
    updatedAt: null,
  };
}
