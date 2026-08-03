// Dialog constants and enums
//
// Wire-protocol enums (MESSAGE_TYPE / CHAT_TYPE / OWNER_TYPE /
// APPROVAL_STATUS) are re-exported from the lib SSOT
// (@flamingo-stack/openframe-frontend-core) — value-identical on every key
// this app used. Notes:
//
// - Lib MESSAGE_TYPE is an 18-key superset of the 10-key local const it
//   replaces (adds THINKING, AI_METADATA, TOKEN_USAGE, compaction,
//   DIRECT_MESSAGE, DIALOG_CLOSED, ...). Intentional — app switches
//   tolerate unknown types.
// - Lib APPROVAL_STATUS adds PENDING and CANCELLED. CANCELLED
//   reconciliation: this app's NATS wire never carries a cancelled
//   resolution — APPROVAL_RESULT chunks encode a boolean `approved`, and
//   the lib's `decodeNatsChunk` maps it to 'approved' | 'rejected' only,
//   exactly like the legacy `parseChunkToAction` did. So cancelled events
//   were never received before and still cannot be produced on this wire;
//   the widened type only matters for shared lib signatures
//   (ChatApprovalStatus). No UI for it exists here by design.

import type { ChatApprovalStatus } from '@flamingo-stack/openframe-frontend-core';

export {
  APPROVAL_STATUS,
  CHAT_TYPE,
  type ChatType,
  MESSAGE_TYPE,
  type MessageType,
  OWNER_TYPE,
  type OwnerType,
} from '@flamingo-stack/openframe-frontend-core';

export type ApprovalStatus = ChatApprovalStatus;

export const DIALOG_STATUS = {
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type DialogStatus = (typeof DIALOG_STATUS)[keyof typeof DIALOG_STATUS];

// Ticket statuses — mirror the backend `TicketStatus` enum.
export const TICKET_STATUS = {
  ACTIVE: 'ACTIVE',
  TECH_REQUIRED: 'TECH_REQUIRED',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type TicketStatusValue = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const DIALOG_MODE = {
  AI: 'AI',
  DIRECT: 'DIRECT',
} as const;

export type DialogModeValue = (typeof DIALOG_MODE)[keyof typeof DIALOG_MODE];

export const ASSISTANT_CONFIG = {
  FAE: {
    type: 'fae' as const,
    name: 'Fae',
  },
  MINGO: {
    type: 'mingo' as const,
    name: 'Mingo',
  },
} as const;

export type AssistantType = (typeof ASSISTANT_CONFIG)[keyof typeof ASSISTANT_CONFIG]['type'];

export const CREATION_SOURCE = {
  FAE_FORM: 'FAE_FORM',
  FAE_DIALOG: 'FAE_DIALOG',
  ADMIN_DASHBOARD: 'ADMIN_DASHBOARD',
} as const;

export type CreationSource = (typeof CREATION_SOURCE)[keyof typeof CREATION_SOURCE];

export const API_ENDPOINTS = {
  GRAPHQL: '/chat/graphql',
  APPROVAL_REQUEST: '/chat/api/v1/approval-requests',
  SEND_MESSAGE: '/chat/api/v1/messages',
  DIALOG_CHUNKS: '/chat/api/v1/dialogs',
  DIALOGS: '/chat/api/v1/dialogs',
} as const;

export const NATS_TOPICS = {
  MESSAGE: 'message',
  ADMIN_MESSAGE: 'admin-message',
} as const;

export type NatsMessageType = (typeof NATS_TOPICS)[keyof typeof NATS_TOPICS];

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'of_access_token',
} as const;

export const NETWORK_CONFIG = {
  SHARED_CLOSE_DELAY_MS: 3000,
  CONNECT_TIMEOUT_MS: 10_000,
  RECONNECT_TIME_WAIT_MS: 2000,
  PING_INTERVAL_MS: 30_000,
  MAX_PING_OUT: 3,
  DEFAULT_MESSAGE_LIMIT: 50,
  POLL_MESSAGE_LIMIT: 10,
} as const;
