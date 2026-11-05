'use client';

/**
 * `renderRecordChip` for `<EmbeddableChat>`: the chip of a record a message names. The lib finds a record link,
 * `[MacBook-Pro-14](record://device/64f0a1)` (the lib's `chat-protocol/record-link.ts`), and calls this with
 * `{ type, id, label }`. The type is read as a kind by the lib's `openFrameRecordKindOf`, and each kind draws a
 * self-fetching chip that links to its detail page. A type that is not an OpenFrame record returns null, and the lib
 * draws its own chip with the link's name.
 *
 * Module-level (not a hook): it needs only the static entity-type config, so a stable identity falls out for free.
 * The lib's per-message memo relies on `renderRecordChip` keeping reference equality across streaming chunks.
 *
 * `chat` (`record://chat/<id>`) is an earlier conversation recalled from chat memory: not an entity, it opens in the
 * drawer rather than on a page (`ChatReferenceChip`). Policy, query and ticket resolve through `RestMentionChip`; a
 * vulnerability needs no fetch at all (its CVE id is its name); every other kind resolves through Relay
 * (`GraphqlMentionChip`). Every chip falls back to a plain id chip (clickable where a route exists) when its fetch
 * cannot resolve a name.
 */

import {
  OPENFRAME_CHAT_RECORD_TYPE,
  OPENFRAME_RECORD_KIND,
  OPENFRAME_RECORD_TYPE,
  type OpenFrameRecordKind,
  openFrameRecordKindOf,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { type ChatContextItem, RecordChip } from '@flamingo-stack/openframe-frontend-core/components/chat';
import type { ReactNode } from 'react';
import { routes } from '@/lib/routes';
import { ChatReferenceChip } from './chat-reference-chip';
import { GraphqlMentionChip } from './relay-mention-chips';
import { RestMentionChip } from './rest-mention-chips';

export function renderMingoRecordChip({
  type,
  id,
  label,
}: {
  type: string;
  id: string;
  /** Known display name: a record link's text or a context item's picked label. Used as the chip's fallback so it
   *  never shows a bare id when the live resolve misses. */
  label?: string;
}): ReactNode {
  // Not an entity: an earlier conversation Mingo cites from chat memory. Opens IN the drawer, never on a page.
  if (type === OPENFRAME_CHAT_RECORD_TYPE) return <ChatReferenceChip id={id} />;
  const kind = openFrameRecordKindOf(type);
  switch (kind) {
    case undefined:
      // Not an OpenFrame record: the lib draws its own chip with the link's name.
      return null;
    case OPENFRAME_RECORD_KIND.VULNERABILITY:
      // A CVE id is its own name: nothing to resolve, so no fetch and no skeleton, a linked chip straight away.
      return <RecordChip type={type} id={id} label={label || id} href={routes.software.vulnerability(id)} />;
    case OPENFRAME_RECORD_KIND.POLICY:
    case OPENFRAME_RECORD_KIND.QUERY:
    case OPENFRAME_RECORD_KIND.TICKET:
      return <RestMentionChip marker={type} id={id} fallbackLabel={label} />;
    default:
      return <GraphqlMentionChip kind={kind} id={id} fallbackLabel={label} />;
  }
}

/**
 * `renderContextItem` for `<EmbeddableChat>`: renders a user's ATTACHED context chip (from `contextItems`)
 * IDENTICALLY to an inline record link. Maps the stored kind to its record type and delegates to
 * `renderMingoRecordChip`, so the attached chip is the same self-fetching, name-resolving, linked chip. Returns null
 * for an unknown kind, and the lib falls back to its default label-only pill. Module-level for a stable identity (the
 * message memo depends on it).
 */
export function renderMingoContextItem(item: ChatContextItem): ReactNode {
  const marker = OPENFRAME_RECORD_TYPE[item.type as OpenFrameRecordKind];
  if (!marker) return null;
  // Context items carry the picked display name: pass it as the chip's fallback so it shows the name immediately
  // (and never a bare id) even if the live re-fetch cannot resolve. `label === id` (history with the label stripped
  // on the wire) is treated as "no label".
  const label = item.label && item.label !== item.id ? item.label : undefined;
  return renderMingoRecordChip({ type: marker, id: item.id, label });
}
