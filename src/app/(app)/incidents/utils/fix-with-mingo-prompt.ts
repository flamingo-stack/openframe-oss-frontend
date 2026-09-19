import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDateTime } from '@/lib/format-date';
import { CONTEXT_ENTITY_KIND } from '../../mingo/context/context-types';
import type { MingoDraft } from '../../mingo/stores/mingo-launcher-store';
import { INCIDENT_SEVERITY_LABELS, INCIDENT_TYPE_LABELS, labelOf } from './incident-labels';
import type { Incident, IncidentRow } from './incident-transform';

/** Evidence rows past this many are summarized as a count — the prompt is for a chat, not a report. */
const MAX_EVIDENCE_ROWS = 10;

/**
 * The draft "Fix with Mingo" puts in a fresh Mingo composer — NOT sent; the
 * technician reads it, edits it, and decides. The incident rides along twice:
 * as an attached `@insight:<id>` context chip (what the ai-agent resolves once
 * its insight resolver is real — today it answers "not available in this
 * build") and spelled out in the text, so the prompt is useful either way. The
 * detail page passes the full `Incident`, so the description and evidence
 * ride along.
 */
export function incidentMingoDraft(incident: IncidentRow | Incident): MingoDraft {
  return {
    text: incidentMingoPrompt(incident),
    // The device rides as a chip too (raw `machineId`, what the DEVICE resolver
    // and `@device:` marker take) rather than as a `@device:` token in the text —
    // the composer would parse that into an id-labelled chip that is not in the
    // context strip.
    mentions: [
      { type: CONTEXT_ENTITY_KIND.INSIGHT, id: incident.id, label: incident.title },
      { type: CONTEXT_ENTITY_KIND.DEVICE, id: incident.machineId, label: incident.deviceName },
    ],
  };
}

function incidentMingoPrompt(incident: IncidentRow | Incident): string {
  const customer = incident.organizationName ? ` (${incident.organizationName})` : '';
  const lines = [
    `Incident: ${incident.title}`,
    `Category: ${labelOf(INCIDENT_TYPE_LABELS, incident.type)} · Severity: ${labelOf(INCIDENT_SEVERITY_LABELS, incident.severity)}`,
    `Device: ${incident.deviceName}${customer}`,
    `Detected: ${formatDateTime(incident.detectedAt)}`,
  ];

  if ('description' in incident && incident.description) {
    lines.push(`What the check looks for: ${incident.description}`);
  }

  if ('queryResult' in incident && incident.queryResult && incident.queryResult.length > 0) {
    const rows = incident.queryResult;
    lines.push('', `Evidence (${rows.length} row${rows.length === 1 ? '' : 's'} from the latest run):`);
    for (const row of rows.slice(0, MAX_EVIDENCE_ROWS)) {
      lines.push(
        `- ${Object.entries(row)
          .map(([key, value]) => `${key}: ${value ?? EMPTY_VALUE}`)
          .join(', ')}`,
      );
    }
    if (rows.length > MAX_EVIDENCE_ROWS) {
      lines.push(`- … and ${rows.length - MAX_EVIDENCE_ROWS} more`);
    }
  }

  lines.push(
    '',
    'Investigate this incident on the device, explain what it means and how urgent it is, and propose a fix.',
  );
  return lines.join('\n');
}
