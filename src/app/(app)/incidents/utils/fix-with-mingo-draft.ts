import { CONTEXT_ENTITY_KIND, CONTEXT_ENTITY_MARKER, type ContextEntityKind } from '../../mingo/context/context-types';
import type { MingoDraft } from '../../mingo/stores/mingo-launcher-store';
import type { IncidentRow } from './incident-transform';

const KIND_BY_MARKER = new Map<string, ContextEntityKind>(
  (Object.entries(CONTEXT_ENTITY_MARKER) as [ContextEntityKind, string][]).map(([kind, marker]) => [marker, kind]),
);

/** One leading `@marker:id` token of the server prompt. */
const LEADING_MARKER = /^@([A-Za-z]+):(\S+)\s*/;

/**
 * The composer draft for "Fix with Mingo", from the server's `insightChatPrompt`.
 *
 * The prompt opens with the context markers (`@insight:<stored id> @device:<machineId>`)
 * and continues with the ask. The markers become ATTACHED mentions rather than
 * text — a `@marker:id` left in the text is parsed into a chip labelled with the
 * id and outside the context strip — with the labels the row already knows;
 * the ask stays as the text. A marker of a kind this build does not know is
 * kept in the text rather than dropped, and does not stop the ones after it
 * from being read.
 */
export function incidentMingoDraft(prompt: string, incident: IncidentRow): MingoDraft {
  const mentions: NonNullable<MingoDraft['mentions']> = [];
  const unknown: string[] = [];
  let rest = prompt.trimStart();
  for (;;) {
    const match = LEADING_MARKER.exec(rest);
    if (!match) break;
    const [token, marker, id] = match;
    rest = rest.slice(token.length);
    const kind = KIND_BY_MARKER.get(marker);
    if (kind) mentions.push({ type: kind, id, label: labelFor(kind, id, incident) });
    else unknown.push(token.trim());
  }
  return { text: [...unknown, rest.trim()].filter(Boolean).join(' '), mentions };
}

function labelFor(kind: ContextEntityKind, id: string, incident: IncidentRow): string {
  if (kind === CONTEXT_ENTITY_KIND.INSIGHT && id === incident.insightId) return incident.title;
  if (kind === CONTEXT_ENTITY_KIND.DEVICE && id === incident.machineId) return incident.deviceName;
  return id;
}
