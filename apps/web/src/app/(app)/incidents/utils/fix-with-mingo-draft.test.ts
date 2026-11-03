import { describe, expect, it } from 'vitest';
import { InsightSeverity, InsightStatus, InsightType } from '@/generated/schema-enums';
import { incidentMingoDraft, linkedInsightId } from './fix-with-mingo-draft';
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
  assignee: null,
};

describe('incidentMingoDraft', () => {
  it('turns the leading record links into labelled mentions and keeps the ask as text', () => {
    const draft = incidentMingoDraft(
      '[this incident](record://insight/qa-insight-2) [this device](record://device/m-1)\n\n' +
        'Using the insight and device context, investigate this problem.',
      incident,
    );
    expect(draft.mentions).toEqual([
      { type: 'INSIGHT', id: 'qa-insight-2', label: 'macOS firewall is off' },
      { type: 'DEVICE', id: 'm-1', label: 'MacBook-Pro-Kirill.local' },
    ]);
    expect(draft.text).toBe('Using the insight and device context, investigate this problem.');
  });

  it('reads a leading link whose address is in angle brackets, the form the record-link grammar allows', () => {
    const draft = incidentMingoDraft(
      '[this incident](<record://insight/qa-insight-2>)\n\nInvestigate this problem.',
      incident,
    );
    expect(draft.mentions).toEqual([{ type: 'INSIGHT', id: 'qa-insight-2', label: 'macOS firewall is off' }]);
    expect(draft.text).toBe('Investigate this problem.');
  });

  it('leaves a link later in the prompt in the text: only what the prompt opens with is attached', () => {
    const draft = incidentMingoDraft('Look at [this device](record://device/m-1) please.', incident);
    expect(draft.mentions).toEqual([]);
    expect(draft.text).toBe('Look at [this device](record://device/m-1) please.');
  });

  // TODO(CU-17tkuw61kfy): what the server sends until the mobile gate is armed.
  it('turns the leading tokens of the prompt the server sends today into the same labelled mentions', () => {
    const draft = incidentMingoDraft(
      '@insight:qa-insight-2 @device:m-1\n\nUsing the insight and device context, investigate this problem.',
      incident,
    );
    expect(draft.mentions).toEqual([
      { type: 'INSIGHT', id: 'qa-insight-2', label: 'macOS firewall is off' },
      { type: 'DEVICE', id: 'm-1', label: 'MacBook-Pro-Kirill.local' },
    ]);
    expect(draft.text).toBe('Using the insight and device context, investigate this problem.');
  });

  it('keeps a token of an unknown type in the text and reads the one after it', () => {
    const draft = incidentMingoDraft('@widget:w-1 @device:m-1 look', incident);
    expect(draft.mentions).toEqual([{ type: 'DEVICE', id: 'm-1', label: 'MacBook-Pro-Kirill.local' }]);
    expect(draft.text).toBe('@widget:w-1 look');
  });

  it('labels an unexpected id with the id itself and keeps a link of an unknown type in the text', () => {
    const draft = incidentMingoDraft('[a](record://insight/other) [w](record://widget/w-1) look', incident);
    expect(draft.mentions).toEqual([{ type: 'INSIGHT', id: 'other', label: 'other' }]);
    expect(draft.text).toBe('[w](record://widget/w-1) look');
  });

  it('reads the links after an unknown one, the id decoded', () => {
    const draft = incidentMingoDraft('[w](record://widget/w-1) [d](record://device/m%2D1) look', {
      ...incident,
      machineId: 'm-1',
    });
    expect(draft.mentions).toEqual([{ type: 'DEVICE', id: 'm-1', label: 'MacBook-Pro-Kirill.local' }]);
    expect(draft.text).toBe('[w](record://widget/w-1) look');
  });

  it('copes with a prompt that has no record links', () => {
    expect(incidentMingoDraft('just text', incident)).toEqual({
      text: 'just text',
      mentions: [],
    });
  });
});

describe('linkedInsightId', () => {
  it('reads the incident a record link names', () => {
    expect(linkedInsightId('[d](record://device/m-1) [this incident](record://insight/qa-insight-2) why?')).toBe(
      'qa-insight-2',
    );
  });

  // TODO(CU-17tkuw61kfy): what the server sends until the mobile gate is armed.
  it('reads the incident a token names, as a whole token', () => {
    expect(linkedInsightId('@insight:qa-insight-2 @device:m-1 why?')).toBe('qa-insight-2');
    expect(linkedInsightId('why is @insight:qa-insight-2 open?')).toBe('qa-insight-2');
    expect(linkedInsightId('mail me@insight:qa-insight-2')).toBeUndefined();
  });

  it('finds none in a message that names no incident', () => {
    expect(linkedInsightId('[d](record://device/m-1) why?')).toBeUndefined();
  });
});
