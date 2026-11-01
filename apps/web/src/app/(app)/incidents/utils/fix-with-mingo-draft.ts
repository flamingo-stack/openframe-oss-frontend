import { parseRecordHref } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { CONTEXT_ENTITY_KIND, CONTEXT_ENTITY_MARKER, type ContextEntityKind } from '../../mingo/context/context-types';
import type { MingoDraft } from '../../mingo/stores/mingo-launcher-store';
import type { IncidentRow } from './incident-transform';

const KIND_BY_MARKER = new Map<string, ContextEntityKind>(
  (Object.entries(CONTEXT_ENTITY_MARKER) as [ContextEntityKind, string][]).map(([kind, marker]) => [marker, kind]),
);

/** One leading record link of the server prompt: `[label](record://<type>/<id>)`. */
const LEADING_RECORD_LINK = /^\[((?:\\.|[^\\[\]\n])*)\]\((record:\/\/[^\s()<>]+)\)\s*/;

/**
 * The composer draft for "Fix with Mingo", from the server's `insightChatPrompt`.
 *
 * The prompt opens with the record links of the records it is about (the incident, then its device) and continues
 * with the ask. The links become ATTACHED mentions, with the labels the row already knows; the ask stays as the
 * text. A link of a type this build does not know is kept in the text, and does not stop the ones after it from
 * being read.
 */
export function incidentMingoDraft(prompt: string, incident: IncidentRow): MingoDraft {
  const mentions: NonNullable<MingoDraft['mentions']> = [];
  const unknown: string[] = [];
  let rest = prompt.trimStart();
  for (;;) {
    const match = LEADING_RECORD_LINK.exec(rest);
    if (!match) break;
    const [whole, , href] = match;
    rest = rest.slice(whole.length);
    const record = parseRecordHref(href);
    const kind = record ? KIND_BY_MARKER.get(record.type) : undefined;
    if (record && kind) mentions.push({ type: kind, id: record.id, label: labelFor(kind, record.id, incident) });
    else unknown.push(whole.trim());
  }
  return { text: [...unknown, rest.trim()].filter(Boolean).join(' '), mentions };
}

function labelFor(kind: ContextEntityKind, id: string, incident: IncidentRow): string {
  if (kind === CONTEXT_ENTITY_KIND.INSIGHT && id === incident.insightId) return incident.title;
  if (kind === CONTEXT_ENTITY_KIND.DEVICE && id === incident.machineId) return incident.deviceName;
  return id;
}
