import {
  extractRecordLinks,
  leadingRecordLinks,
  openFrameRecordKindOf,
  OPENFRAME_RECORD_KIND,
  OPENFRAME_RECORD_TYPE,
  type OpenFrameRecordKind,
} from '@flamingo-stack/openframe-frontend-core/chat-protocol';
import type { MingoDraft } from '../../mingo/stores/mingo-launcher-store';
import type { IncidentRow } from './incident-transform';

/** The incident a message links: the first record link of type insight in it (`[…](record://insight/<id>)`). */
export function linkedInsightId(text: string): string | undefined {
  return extractRecordLinks(text).find(record => record.type === OPENFRAME_RECORD_TYPE.INSIGHT)?.id;
}

/**
 * The composer draft for "Fix with Mingo", from the server's `insightChatPrompt`.
 *
 * The prompt opens with the records it is about (the incident, then its device) and continues with the ask. They
 * become ATTACHED mentions, with the labels the row already knows; the ask stays as the text. A record of a type this
 * build does not know is kept in the text, and does not stop the ones after it from being read. The record links are
 * read by the lib's one parser (`leadingRecordLinks`), and their types by its one table of OpenFrame record types.
 */
export function incidentMingoDraft(prompt: string, incident: IncidentRow): MingoDraft {
  const text = prompt.trimStart();
  const { links, rest } = leadingRecordLinks(text);
  const mentions: NonNullable<MingoDraft['mentions']> = [];
  const unknown: string[] = [];
  for (const link of links) {
    const kind = openFrameRecordKindOf(link.type);
    if (kind) mentions.push({ type: kind, id: link.id, label: labelFor(kind, link.id, incident) });
    else unknown.push(text.slice(link.start, link.end));
  }
  return { text: [...unknown, rest].filter(Boolean).join(' '), mentions };
}

function labelFor(kind: OpenFrameRecordKind, id: string, incident: IncidentRow): string {
  if (kind === OPENFRAME_RECORD_KIND.INSIGHT && id === incident.insightId) return incident.title;
  if (kind === OPENFRAME_RECORD_KIND.DEVICE && id === incident.machineId) return incident.deviceName;
  return id;
}
