'use client';

/**
 * `renderRecordChip` for `<EmbeddableChat>`: the chip of a record a message names. The lib finds a record link,
 * `[MacBook-Pro-14](record://device/64f0a1)` (the lib's `chat-protocol/record-link.ts`), and calls this with
 * `{ type, id, label }`; we dispatch by type to a SELF-FETCHING chip (each entity type owns its own fetcher +
 * detail-page link). A type we have no chip for returns null, and the lib draws its own chip with the link's name.
 *
 * Module-level (not a hook): it needs only the static entity-type config, so a
 * stable identity falls out for free — the lib's per-message memo relies on
 * `renderRecordChip` keeping reference equality across streaming chunks.
 *
 * Coverage = every record type the agent links, plus `chat` (`record://chat/<id>`) —
 * an EARLIER CONVERSATION recalled from chat memory, which is not an entity and
 * opens in the drawer rather than on a page (`ChatReferenceChip`).
 * GraphQL types (device, customer, user, kb article, kb folder, scheduled script,
 * incident, software) resolve via Relay; REST/ai-agent types (policy, query,
 * ticket) via `RestMentionChip`; a vulnerability needs no fetch at all —
 * its CVE id IS its name. SCRIPT is dual-sourced — a NEW script (24-char
 * ObjectId) resolves via Relay, a LEGACY Tactical script (numeric id) via REST —
 * so both kinds of script id render regardless of the flag. Every chip falls
 * back to a plain id chip (clickable where a route exists) if its fetch can't
 * resolve a name. Unknown type → the lib's own chip.
 */

import {
  OPENFRAME_CHAT_RECORD_TYPE,
  OPENFRAME_RECORD_KIND,
  OPENFRAME_RECORD_TYPE,
  type OpenFrameRecordKind,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { type ChatContextItem, RecordChip } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { ReactNode } from 'react';
import { routes } from '@/lib/routes';
import { ChatReferenceChip } from './chat-reference-chip';
import { GraphqlMentionChip } from './relay-mention-chips';
import { RestMentionChip } from './rest-mention-chips';

/**
 * New OpenFrame scripts carry a 24-char Mongo ObjectId raw db id; legacy Tactical
 * scripts carry a plain numeric id. Used to route a script's record link to the right
 * resolver (Relay vs Tactical REST) so both kinds render.
 */
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

export function renderMingoRecordChip({
  type,
  id,
  label,
}: {
  type: string;
  id: string;
  /** Known display name: a record link's text or a context item's picked label. Used as the chip's fallback so it
   *  never shows a bare id when the live resolve misses (e.g. a script id the resolver can't find). */
  label?: string;
}): ReactNode {
  switch (type) {
    case OPENFRAME_CHAT_RECORD_TYPE:
      // Not an entity: an earlier conversation Mingo cites from chat memory.
      // Opens IN the drawer (see the chip), never on a page.
      return <ChatReferenceChip id={id} />;
    case OPENFRAME_RECORD_TYPE.DEVICE:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.DEVICE} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.ORGANIZATION:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.ORGANIZATION} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.KB_ARTICLE:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.KB_ARTICLE} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.KB_FOLDER:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.KB_FOLDER} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.SCHEDULED_SCRIPT:
      // Native-only (schedules never existed in Tactical), so — unlike SCRIPT
      // below — there is no id-shape dispatch: every id resolves through Relay.
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.SCHEDULED_SCRIPT} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.INSIGHT:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.INSIGHT} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.SOFTWARE:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.SOFTWARE} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.VULNERABILITY:
      // A CVE id is its own name: nothing to resolve, so no fetch and no
      // skeleton — a linked chip straight away.
      return <RecordChip type={type} id={id} label={label || id} href={routes.software.vulnerability(id)} />;
    case OPENFRAME_RECORD_TYPE.SCRIPT:
      // Dual-sourced: a 24-char ObjectId is a NATIVE script (Relay `script(id:)`);
      // anything else (numeric) is a LEGACY Tactical id, still reachable in old
      // chat history even though nothing writes those ids any more.
      return OBJECT_ID_RE.test(id) ? (
        <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.SCRIPT} id={id} fallbackLabel={label} />
      ) : (
        <RestMentionChip marker={type} id={id} fallbackLabel={label} />
      );
    case OPENFRAME_RECORD_TYPE.USER:
      return <GraphqlMentionChip kind={OPENFRAME_RECORD_KIND.USER} id={id} fallbackLabel={label} />;
    case OPENFRAME_RECORD_TYPE.POLICY:
    case OPENFRAME_RECORD_TYPE.QUERY:
    case OPENFRAME_RECORD_TYPE.TICKET:
      return <RestMentionChip marker={type} id={id} fallbackLabel={label} />;
    default:
      // Unknown type → the lib draws its own chip with the link's name.
      return null;
  }
}

/**
 * `renderContextItem` for `<EmbeddableChat>` — renders a user's ATTACHED context
 * chip (from `contextItems`) IDENTICALLY to an inline record link.
 * Bridges the structured `{ type: <KIND>, id }` shape to the record-type-keyed
 * path: maps the stored kind to its record type and delegates to
 * `renderMingoRecordChip`, so the attached chip is the same self-fetching,
 * name-resolving, linked chip. Returns null for an unknown kind → the lib falls
 * back to its default label-only pill. Module-level for a stable identity (the
 * message memo depends on it).
 */
export function renderMingoContextItem(item: ChatContextItem): ReactNode {
  const marker = OPENFRAME_RECORD_TYPE[item.type as OpenFrameRecordKind];
  if (!marker) return null;
  // Context items carry the picked display name — pass it as the chip's fallback
  // so it shows the name immediately (and never a bare id) even if the live
  // re-fetch can't resolve. `label === id` (history with the label stripped on
  // the wire) is treated as "no label".
  const label = item.label && item.label !== item.id ? item.label : undefined;
  return renderMingoRecordChip({ type: marker, id: item.id, label });
}
