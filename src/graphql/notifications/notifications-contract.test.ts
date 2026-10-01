import { getApprovalMeta, isApprovalNotification } from '@flamingo-stack/openframe-frontend-core';
import type ReactRelay from 'react-relay';
import { describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run;
// the tag would throw at module scope on import. The mapper under test takes already-read
// data, so the fragment object itself is never touched here.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
}));

import type { notificationFields_notification$data as NotificationFieldsData } from '@/__generated__/notificationFields_notification.graphql';
import { isApprovalResolved, mapNotificationNode } from './notifications-helpers';

/**
 * The row contract is the flat `type` + `attributes` pair. `attributes` is an untyped JSON
 * scalar, so nothing but these tests catches a wrong key, a dropped fact, or a shape the
 * core lib's approval tile cannot read.
 */

const BASE = {
  id: 'Tm90aWZpY2F0aW9uOjE=',
  severity: 'INFO',
  title: 'A title',
  description: 'A description',
  createdAt: '2026-08-24T10:00:00Z',
  read: false,
  category: 'TICKETS',
} as const;

function node(overrides: Record<string, unknown>): NotificationFieldsData {
  return { ...BASE, type: null, attributes: null, ...overrides } as NotificationFieldsData;
}

describe('type + attributes rows', () => {
  it('reads entity ids off attributes', () => {
    const mapped = mapNotificationNode(
      node({ type: 'TICKET_ASSIGNED', attributes: { ticketId: 't-2', ticketNumber: '238', assigneeName: 'Ann' } }),
    );
    expect(mapped.meta?.ticketId).toBe('t-2');
    expect(mapped.meta?.notificationType).toBe('TICKET_ASSIGNED');
    expect(mapped.type).toBe('Ticket Assigned');
  });

  it('carries through attributes this release has no code for', () => {
    const mapped = mapNotificationNode(
      node({ type: 'TICKET_STATUS_CHANGED', attributes: { ticketId: 't-3', newStatusLabel: 'In Progress' } }),
    );
    expect(mapped.meta?.newStatusLabel).toBe('In Progress');
  });

  it('treats an empty attribute value as an absent fact', () => {
    const mapped = mapNotificationNode(node({ type: 'TICKET_ASSIGNED', attributes: { ticketId: '' } }));
    expect(mapped.meta?.ticketId).toBeUndefined();
  });

  it('keeps the type when the attribute map is missing', () => {
    const mapped = mapNotificationNode(node({ type: 'TICKET_ASSIGNED' }));
    expect(mapped.meta?.notificationType).toBe('TICKET_ASSIGNED');
    expect(mapped.meta?.ticketId).toBeUndefined();
  });
});

describe('the approval split', () => {
  const attributes = {
    approvalRequestId: 'a-2',
    approvalType: 'TOOL',
    resolution: 'PENDING',
    toolCalls: JSON.stringify([{ toolName: 'run_script', requiresApproval: true, toolCallArguments: { cmd: 'ls' } }]),
  };

  it('gates the approval tile on either approval type', () => {
    for (const type of ['TICKET_APPROVAL_REQUEST', 'MINGO_APPROVAL_REQUEST']) {
      const mapped = mapNotificationNode(node({ type, attributes: { ...attributes, ticketId: 't-4' } }));
      expect(isApprovalNotification(mapped), type).toBe(true);
      expect(mapped.meta?.notificationType, type).toBe(type);
    }
  });

  it('does not gate a non-approval type on the approval tile', () => {
    const mapped = mapNotificationNode(
      node({ type: 'TICKET_ASSIGNED', attributes: { ...attributes, ticketId: 't-4' } }),
    );
    expect(isApprovalNotification(mapped)).toBe(false);
  });

  it('parses the JSON-encoded tool call array out of its string', () => {
    const mapped = mapNotificationNode(
      node({ type: 'MINGO_APPROVAL_REQUEST', attributes: { ...attributes, dialogId: 'd-2' } }),
    );
    const approval = getApprovalMeta(mapped);
    expect(approval?.dialogId).toBe('d-2');
    expect(approval?.approvalType).toBe('TOOL');
    expect(approval?.toolCalls).toHaveLength(1);
    expect(approval?.toolCalls[0].toolName).toBe('run_script');
    expect(approval?.toolCalls[0].toolCallArguments).toEqual({ cmd: 'ls' });
  });

  it('degrades to a plain tile instead of throwing on a malformed tool call string', () => {
    const mapped = mapNotificationNode(
      node({ type: 'MINGO_APPROVAL_REQUEST', attributes: { ...attributes, toolCalls: 'not json' } }),
    );
    expect(getApprovalMeta(mapped)?.toolCalls).toEqual([]);
  });

  it('picks up the resolution an UPDATED push writes into attributes', () => {
    const mapped = mapNotificationNode(
      node({
        type: 'TICKET_APPROVAL_REQUEST',
        attributes: { ...attributes, ticketId: 't-5', resolution: 'APPROVED', resolvedByName: 'Ann' },
      }),
    );
    expect(getApprovalMeta(mapped)?.resolution).toBe('APPROVED');
    expect(getApprovalMeta(mapped)?.resolvedByName).toBe('Ann');
  });
});

/**
 * The incident card is drawn off the incident, not off the stamped severity: the backend
 * marks every detection WARNING and every transition INFO, the design wants grey unless a
 * critical or high incident was just detected. The family is recognised under both the
 * current INSIGHT_* spelling and the INCIDENT_* one the backend is asked to move to.
 */
describe('incident rows', () => {
  const insight = { insightId: 'i-1', machineId: 'm-1', insightKind: 'SECURITY' };

  it('labels the type as the backend spells it, never re-worded', () => {
    expect(mapNotificationNode(node({ type: 'INSIGHT_DETECTED' })).type).toBe('Insight Detected');
    expect(mapNotificationNode(node({ type: 'INCIDENT_DETECTED' })).type).toBe('Incident Detected');
    expect(mapNotificationNode(node({ type: 'INCIDENT_SNOOZED' })).type).toBe('Incident Snoozed');
  });

  it('paints a critical or high detection red, whatever the backend stamped', () => {
    for (const type of ['INSIGHT_DETECTED', 'INCIDENT_DETECTED']) {
      for (const insightSeverity of ['CRITICAL', 'HIGH']) {
        const mapped = mapNotificationNode(
          node({ type, severity: 'WARNING', attributes: { ...insight, insightSeverity } }),
        );
        expect(mapped.severity, `${type} ${insightSeverity}`).toBe('DANGER');
        expect(mapped.variant, `${type} ${insightSeverity}`).toBe('error');
      }
    }
  });

  it('keeps a lesser detection on the neutral card instead of the stamped WARNING', () => {
    for (const insightSeverity of ['MEDIUM', 'LOW', 'INFO']) {
      const mapped = mapNotificationNode(
        node({ type: 'INSIGHT_DETECTED', severity: 'WARNING', attributes: { ...insight, insightSeverity } }),
      );
      expect(mapped.severity, insightSeverity).toBe('INFO');
      expect(mapped.variant, insightSeverity).toBe('info');
    }
    // A detection that lost its severity attribute is not a reason to shout.
    expect(mapNotificationNode(node({ type: 'INSIGHT_DETECTED', severity: 'WARNING' })).severity).toBe('INFO');
  });

  it('draws every status transition neutral, even for a critical incident', () => {
    for (const type of ['INSIGHT_ACKNOWLEDGED', 'INSIGHT_SNOOZED', 'INSIGHT_RESOLVED', 'INCIDENT_RESOLVED']) {
      const mapped = mapNotificationNode(
        node({ type, severity: 'DANGER', attributes: { ...insight, insightSeverity: 'CRITICAL', actor: 'Ann' } }),
      );
      expect(mapped.severity, type).toBe('INFO');
      expect(mapped.meta?.actor, type).toBe('Ann');
    }
  });

  it('leaves every other type on the severity the backend stamped', () => {
    const mapped = mapNotificationNode(
      node({
        type: 'TICKET_ASSIGNED',
        severity: 'WARNING',
        attributes: { ticketId: 't-1', insightSeverity: 'CRITICAL' },
      }),
    );
    expect(mapped.severity).toBe('WARNING');
  });
});

describe('rows with neither type nor attributes', () => {
  it('still map, offering no entity metadata', () => {
    const mapped = mapNotificationNode(node({}));
    expect(mapped.title).toBe('A title');
    expect(mapped.type).toBeUndefined();
    expect(mapped.meta?.ticketId).toBeUndefined();
    expect(mapped.meta?.notificationType).toBeUndefined();
    expect(isApprovalNotification(mapped)).toBe(false);
  });
});

describe('approval resolution', () => {
  it('treats only terminal values as resolved', () => {
    expect(isApprovalResolved('APPROVED')).toBe(true);
    expect(isApprovalResolved('REJECTED')).toBe(true);
    expect(isApprovalResolved('CANCELLED')).toBe(true);
  });

  it('does not treat a freshly emitted PENDING request as resolved', () => {
    // The attribute map carries `resolution` from the start — a truthiness check here
    // would retire live approvals to the read list.
    expect(isApprovalResolved('PENDING')).toBe(false);
    expect(isApprovalResolved(null)).toBe(false);
    expect(isApprovalResolved(undefined)).toBe(false);
    expect(isApprovalResolved('')).toBe(false);
  });
});
