import { getApprovalMeta, isApprovalNotification } from '@flamingo-stack/openframe-frontend-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run;
// the tag would throw at module scope on import. The mapper under test takes already-read
// data, so the fragment object itself is never touched here.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof import('react-relay')>()),
  graphql: () => ({}),
}));

import type { notificationFields_notification$data as NotificationFieldsData } from '@/__generated__/notificationFields_notification.graphql';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { isApprovalResolved, mapNotificationNode } from './notifications-helpers';

/**
 * The backend is mid-migration from a typed `context` union to a flat `type` + `attributes`
 * pair, and both shapes are on the wire at once: legacy rows carry only `context`, spec-path
 * rows carry only `type`/`attributes`, and a kill-switch can flip emission back at any time.
 * These pin that the mapper reads whichever shape arrived — the tests are the contract, since
 * `attributes` is an untyped JSON scalar and nothing else catches a wrong key.
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
  return { ...BASE, type: null, attributes: null, context: null, ...overrides } as NotificationFieldsData;
}

/** A legacy typed context record, keyed by its GraphQL `__typename` the way Relay flattens it. */
function legacyContext(typename: string, fields: Record<string, unknown>) {
  // biome-ignore lint/style/useNamingConvention: __typename is GraphQL's discriminator, not ours
  return { __typename: typename, ...fields };
}

describe('legacy context rows', () => {
  it('reads entity ids off the typed context', () => {
    const mapped = mapNotificationNode(
      node({ context: legacyContext('TicketAssignedContext', { type: 'TICKET_ASSIGNED', ticketId: 't-1' }) }),
    );
    expect(mapped.meta?.ticketId).toBe('t-1');
    expect(mapped.meta?.contextType).toBe('TICKET_ASSIGNED');
  });

  it('keeps the approval tile working off context.toolCalls', () => {
    const mapped = mapNotificationNode(
      node({
        category: 'MINGO',
        context: legacyContext('AdminApprovalRequestContext', {
          type: 'ADMIN_APPROVAL_REQUEST',
          approvalRequestId: 'a-1',
          dialogId: 'd-1',
          approvalType: 'TOOL',
          resolution: null,
          resolvedByName: null,
          toolCalls: [{ toolName: 'run_script', requiresApproval: true }],
        }),
      }),
    );
    expect(isApprovalNotification(mapped)).toBe(true);
    expect(getApprovalMeta(mapped)?.toolCalls).toHaveLength(1);
    expect(getApprovalMeta(mapped)?.dialogId).toBe('d-1');
  });
});

describe('spec attribute rows', () => {
  it('reads entity ids off attributes when no context is present', () => {
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

  it('prefers the spec type over a legacy context type on a dual-shape row', () => {
    const mapped = mapNotificationNode(
      node({
        type: 'TICKET_REOPENED',
        attributes: { ticketId: 'from-attributes' },
        context: legacyContext('TicketReopenedContext', { type: 'TICKET_REOPENED', ticketId: 'from-context' }),
      }),
    );
    expect(mapped.meta?.ticketId).toBe('from-attributes');
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

describe('rows with neither shape', () => {
  it('still maps, offering no entity metadata', () => {
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
    // The attribute map carries `resolution` from the start, unlike the legacy context which
    // left it null — a truthiness check here would retire live approvals to the read list.
    expect(isApprovalResolved('PENDING')).toBe(false);
    expect(isApprovalResolved(null)).toBe(false);
    expect(isApprovalResolved(undefined)).toBe(false);
    expect(isApprovalResolved('')).toBe(false);
  });
});

describe('the notifications-legacy-path rollback lever', () => {
  const setFlag = (value: boolean) =>
    useFeatureFlagsStore.setState({ isLoaded: true, flags: { 'notifications-legacy-path': value } });

  afterEach(() => useFeatureFlagsStore.setState({ isLoaded: false, flags: {} }));

  const dualShapeRow = () =>
    node({
      type: 'TICKET_REOPENED',
      attributes: { ticketId: 'from-attributes' },
      context: legacyContext('TicketReopenedContext', { type: 'TICKET_REOPENED', ticketId: 'from-context' }),
    });

  it('prefers attributes while off', () => {
    setFlag(false);
    expect(mapNotificationNode(dualShapeRow()).meta?.ticketId).toBe('from-attributes');
  });

  it('prefers the legacy context while on', () => {
    setFlag(true);
    expect(mapNotificationNode(dualShapeRow()).meta?.ticketId).toBe('from-context');
  });

  it('is off when the server has never heard of the flag', () => {
    // It ships before the backend declares it — an undeclared flag must read as off,
    // not as "unknown", or turning the lever on later would be the only safe state.
    useFeatureFlagsStore.setState({ isLoaded: true, flags: {} });
    expect(mapNotificationNode(dualShapeRow()).meta?.ticketId).toBe('from-attributes');
  });

  it('still falls back when the preferred shape is absent', () => {
    // The lever flips preference, never the fallback: rows predating the backfill carry
    // no attributes, and rows on the spec path may carry no context.
    setFlag(true);
    expect(mapNotificationNode(node({ type: 'TICKET_ASSIGNED', attributes: { ticketId: 't-1' } })).meta?.ticketId).toBe(
      't-1',
    );

    setFlag(false);
    const legacyOnly = node({
      context: legacyContext('TicketAssignedContext', { type: 'TICKET_ASSIGNED', ticketId: 't-2' }),
    });
    expect(mapNotificationNode(legacyOnly).meta?.ticketId).toBe('t-2');
  });

  it('reads approval tool calls from the legacy context while on', () => {
    setFlag(true);
    const mapped = mapNotificationNode(
      node({
        type: 'MINGO_APPROVAL_REQUEST',
        attributes: { approvalRequestId: 'a-1', toolCalls: JSON.stringify([{ toolName: 'from_attributes' }]) },
        context: legacyContext('AdminApprovalRequestContext', {
          type: 'ADMIN_APPROVAL_REQUEST',
          approvalRequestId: 'a-1',
          toolCalls: [{ toolName: 'from_context' }],
        }),
      }),
    );
    expect(getApprovalMeta(mapped)?.toolCalls[0].toolName).toBe('from_context');
  });
});
