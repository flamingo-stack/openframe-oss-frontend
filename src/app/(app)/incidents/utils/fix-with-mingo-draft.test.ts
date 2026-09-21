import { describe, expect, it } from 'vitest';
import { InsightSeverity, InsightStatus, InsightType } from '@/generated/schema-enums';
import { incidentMingoDraft } from './fix-with-mingo-draft';
import type { IncidentRow } from './incident-transform';

const incident: IncidentRow = {
  id: 'SW5zaWdodDpxYS1pbnNpZ2h0LTI',
  insightId: 'qa-insight-2',
  title: 'macOS firewall is off',
  type: InsightType.SECURITY,
  severity: InsightSeverity.HIGH,
  status: InsightStatus.NEW,
  snoozedUntil: null,
  detectedAt: '2026-09-16T23:02:00Z',
  machineId: 'm-1',
  hasDevice: true,
  deviceName: 'MacBook-Pro-Kirill.local',
  deviceType: 'laptop',
  organizationId: 'o-1',
  organizationName: 'куукку',
};

describe('incidentMingoDraft', () => {
  it('turns the leading markers into labelled mentions and keeps the ask as text', () => {
    const draft = incidentMingoDraft(
      '@insight:qa-insight-2 @device:m-1\n\nUsing the insight and device context, investigate this problem.',
      incident,
    );
    expect(draft.mentions).toEqual([
      { type: 'INSIGHT', id: 'qa-insight-2', label: 'macOS firewall is off' },
      { type: 'DEVICE', id: 'm-1', label: 'MacBook-Pro-Kirill.local' },
    ]);
    expect(draft.text).toBe('Using the insight and device context, investigate this problem.');
    expect(draft.insightId).toBe('qa-insight-2');
  });

  it('labels an unexpected id with the id itself and leaves an unknown marker in the text', () => {
    const draft = incidentMingoDraft('@insight:other @widget:w-1 look', incident);
    expect(draft.mentions).toEqual([{ type: 'INSIGHT', id: 'other', label: 'other' }]);
    expect(draft.text).toBe('@widget:w-1 look');
  });

  it('copes with a prompt that has no markers', () => {
    expect(incidentMingoDraft('just text', incident)).toEqual({
      text: 'just text',
      mentions: [],
      insightId: 'qa-insight-2',
    });
  });
});
