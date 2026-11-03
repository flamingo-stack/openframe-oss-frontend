import { extractRecordLinks, parseRecordHref } from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import { CONTEXT_ENTITY_KIND, CONTEXT_ENTITY_MARKER, type ContextEntityKind } from '../../mingo/context/context-types';
import type { MingoDraft } from '../../mingo/stores/mingo-launcher-store';
import type { IncidentRow } from './incident-transform';

const KIND_BY_MARKER = new Map<string, ContextEntityKind>(
  (Object.entries(CONTEXT_ENTITY_MARKER) as [ContextEntityKind, string][]).map(([kind, marker]) => [marker, kind]),
);

/** One leading record link of the server prompt: `[label](record://<type>/<id>)`. */
const LEADING_RECORD_LINK = /^\[((?:\\.|[^\\[\]\n])*)\]\((record:\/\/[^\s()<>]+)\)\s*/;

/**
 * TODO(CU-17tkuw61kfy): the prompt opens with `@marker:id` tokens until the mobile gate is armed, because frozen bundles
 * read only those, and with record links after it. This build reads both.
 */
const LEADING_MARKER = /^@([A-Za-z]+):(\S+)\s*/;
const INSIGHT_MARKER = new RegExp(`(?:^|\\s)@${CONTEXT_ENTITY_MARKER.INSIGHT}:(\\S+)`);

/** The incident a message links: the first record link of type insight in it (`[…](record://insight/<id>)`). */
export function linkedInsightId(text: string): string | undefined {
  const linked = extractRecordLinks(text).find(record => record.type === CONTEXT_ENTITY_MARKER.INSIGHT)?.id;
  return linked ?? INSIGHT_MARKER.exec(text)?.[1];
}

/** The record the prompt opens with, and the text naming it; `type` and `id` are absent on a link that names none. */
function leadingRecord(prompt: string): { whole: string; type?: string; id?: string } | null {
  const link = LEADING_RECORD_LINK.exec(prompt);
  if (link) {
    const record = parseRecordHref(link[2]);
    return { whole: link[0], type: record?.type, id: record?.id };
  }
  const marker = LEADING_MARKER.exec(prompt);
  return marker ? { whole: marker[0], type: marker[1], id: marker[2] } : null;
}

/**
 * The composer draft for "Fix with Mingo", from the server's `insightChatPrompt`.
 *
 * The prompt opens with the records it is about (the incident, then its device) and continues with the ask. They
 * become ATTACHED mentions, with the labels the row already knows; the ask stays as the text. A record of a type this
 * build does not know is kept in the text, and does not stop the ones after it from being read.
 */
export function incidentMingoDraft(prompt: string, incident: IncidentRow): MingoDraft {
  const mentions: NonNullable<MingoDraft['mentions']> = [];
  const unknown: string[] = [];
  let rest = prompt.trimStart();
  for (;;) {
    const record = leadingRecord(rest);
    if (!record) break;
    rest = rest.slice(record.whole.length);
    const kind = record.type ? KIND_BY_MARKER.get(record.type) : undefined;
    if (record.id && kind) mentions.push({ type: kind, id: record.id, label: labelFor(kind, record.id, incident) });
    else unknown.push(record.whole.trim());
  }
  return { text: [...unknown, rest.trim()].filter(Boolean).join(' '), mentions };
}

function labelFor(kind: ContextEntityKind, id: string, incident: IncidentRow): string {
  if (kind === CONTEXT_ENTITY_KIND.INSIGHT && id === incident.insightId) return incident.title;
  if (kind === CONTEXT_ENTITY_KIND.DEVICE && id === incident.machineId) return incident.deviceName;
  return id;
}
