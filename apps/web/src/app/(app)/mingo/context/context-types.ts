import {
  OPENFRAME_RECORD_KIND,
  OPENFRAME_RECORD_KINDS,
  OPENFRAME_RECORD_TYPE,
  type OpenFrameRecordKind,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';

/**
 * Mingo entity-context types shared across the host's context layer (the
 * picker config, the recent-views store, and the send payload).
 *
 * The backend message payload (the `sendMessage` mutation) carries context as
 * `{ type, id }` pairs — see `ContextRef`. The picker/store keep a `label`
 * alongside for display (chips + the dev window); the label is stripped when
 * building the wire payload.
 *
 * The kinds and each kind's record type (the `<type>` of its record link) are
 * the lib's ONE table of OpenFrame record types (`OPENFRAME_RECORD_KIND`,
 * `OPENFRAME_RECORD_TYPE`), which the agent's `ContextItemType` matches by name.
 * To add a kind: add it there, then wire its label/icon in
 * `MINGO_CONTEXT_ENTITY_TYPES` and its fetcher in `FETCHERS` (both in
 * `context-sources.tsx`). The TS `Record<ContextEntityKind, …>` on `FETCHERS`
 * makes a missing entry a compile error.
 */
export const CONTEXT_ENTITY_KIND = OPENFRAME_RECORD_KIND;

export type ContextEntityKind = OpenFrameRecordKind;

/** All kinds as a runtime list, in declaration order. */
export const CONTEXT_ENTITY_KINDS = OPENFRAME_RECORD_KINDS;

/** Each kind's record type: the `<type>` of its record link (`record://device/…`, `record://kb/…`). */
export const CONTEXT_ENTITY_MARKER = OPENFRAME_RECORD_TYPE;

/**
 * Relay `__typename` for the GraphQL-resolvable kinds. Used ONLY to round-trip a
 * raw db id back to a Relay global id (`base64("<typename>:<rawId>")`, see
 * `@/lib/relay-id`) right before a client-side `node(id:)` fetch in the chips.
 *
 * TEMPORARY (intentional hack): record links AND contextItems carry RAW database ids
 * — that's what the backend context resolvers expect, and
 * what we store + send on the wire. But Relay's store is keyed by GLOBAL id, so
 * each chip must re-encode the raw id before fetching. On the way IN (manual
 * context-add in the picker) we do the inverse: take the GraphQL node's global
 * `id`, `decodeGlobalId` it, and store the decoded raw id. This typename map
 * never leaves the client. The remaining REST kinds (user/policy/query/ticket)
 * resolve via their own REST fetchers and have NO entry here — nor do SOFTWARE
 * and VULNERABILITY, whose stored id already IS what their query takes. Drop
 * this whole dance once the backend speaks global ids end-to-end for context.
 */
export const CONTEXT_RELAY_TYPENAME: Partial<Record<ContextEntityKind, string>> = {
  DEVICE: 'Machine',
  ORGANIZATION: 'Organization',
  KB_ARTICLE: 'KnowledgeBaseItem',
  KB_FOLDER: 'KnowledgeBaseItem',
  SCRIPT: 'Script',
  SCHEDULED_SCRIPT: 'ScriptSchedule',
  USER: 'User',
  // An INSIGHT reference carries the STORED id (what the ai-agent's resolver looks
  // up); the chip re-encodes it through `ensureGlobalIdForType('Insight', …)` for
  // the `insight(id:)` query, which takes the global handle.
  INSIGHT: 'Insight',
};

/** Minimal wire shape for `contextItems` / `currentView` / `recentViews`. */
export interface ContextRef {
  type: ContextEntityKind;
  id: string;
}

/** A context ref enriched with display metadata (label + optional secondary
 *  line). Persisted in the recent-views store and rendered in the dev window. */
export interface ContextRefWithLabel extends ContextRef {
  label: string;
  description?: string;
}

/** Limits from the spec. */
export const CONTEXT_ITEMS_MAX = 10;
export const RECENT_VIEWS_MAX = 5;
