import { getApprovalMeta, isApprovalNotification } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run;
// the tag would throw at module scope on import. The mapper under test takes already-read
// data, so the fragment object itself is never touched here.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof import('react-relay')>()),
  graphql: () => ({}),
}));

import type { notificationFields_notification$data as NotificationFieldsData } from '@/__generated__/notificationFields_notification.graphql';
import { isApprovalResolved, mapNotificationNode } from './notifications-helpers';

/**
 * The row mapper reads the spec contract: `type` + the flat `attributes` map. These tests
 * are the only thing pinning it — `attributes` is an untyped JSON scalar, so nothing else
 * catches a wrong key.
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

describe('spec attribute rows', () => {
  it('reads entity ids off attributes', () => {
    const mapped = mapNotificationNode(
      node({ type: 'TICKET_ASSIGNED', attributes: { ticketId: 't-2', ticketNumber: '238', assigneeName: 'Ann' } }),
    );
    expect(mapped.meta?.ticketId).toBe('t-2');
    expect(mapped.meta?.notificationType).toBe('TICKET_ASSIGNED');
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
});

describe('the approval split', () => {
  const attributes = {
    approvalRequestId: 'a-2',
    approvalType: 'TOOL',
    resolution: 'PENDING',
    toolCalls: JSON.stringify([{ toolName: 'run_script', requiresApproval: true, toolCallArguments: { cmd: 'ls' } }]),
  };

  it('folds both spec approval types onto the discriminator the core lib gates on', () => {
    for (const type of ['TICKET_APPROVAL_REQUEST', 'MINGO_APPROVAL_REQUEST']) {
      const mapped = mapNotificationNode(node({ type, attributes: { ...attributes, ticketId: 't-4' } }));
      expect(isApprovalNotification(mapped), type).toBe(true);
      expect(mapped.meta?.notificationType, type).toBe(type);
    }
  });

  it('parses the JSON-encoded tool call array out of its string', () => {
    const mapped = mapNotificationNode(
      node({ type: 'MINGO_APPROVAL_REQUEST', attributes: { ...attributes, dialogId: 'd-2' } }),
    );
    const approval = getApprovalMeta(mapped);
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

describe('rows with neither type nor attributes', () => {
  it('still map, offering no entity metadata', () => {
    const mapped = mapNotificationNode(node({}));
    expect(mapped.title).toBe('A title');
    expect(mapped.meta?.ticketId).toBeUndefined();
    expect(mapped.meta?.contextType).toBeUndefined();
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
