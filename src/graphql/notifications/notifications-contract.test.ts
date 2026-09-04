import { getApprovalMeta, isApprovalNotification } from '@flamingo-stack/openframe-frontend-core';
import type ReactRelay from 'react-relay';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest doesn't run;
// the tag would throw at module scope on import. The mapper under test takes already-read
// data, so the fragment object itself is never touched here.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
}));

import type { notificationFields_notification$data as NotificationFieldsData } from '@/__generated__/notificationFields_notification.graphql';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { isApprovalResolved, mapNotificationNode } from './notifications-helpers';

/**
 * The backend is mid-migration from a typed `context` union to a flat `type` + `attributes`
 * pair, and both shapes are on the wire at once: legacy rows carry only `context`, spec-path
 * rows carry only `type`/`attributes`, and a kill-switch can flip emission back at any time.
 *
 * The mapper reads exactly ONE of them, chosen by the `notifications-legacy-path` lever, and
 * never mixes the two on a row — so these tests come in pairs: what each shape yields on its
 * own path, and what it yields (nothing) on the other one. That exclusivity is the contract,
 * and the tests are the only thing pinning it: `attributes` is an untyped JSON scalar, so
 * nothing else catches a wrong key or a fallback creeping back in.
 */

/**
 * The lever the mapper reads. Hoisted out of its own suite because it now decides which
 * shape EVERY test here is exercising — a legacy-context row is only read on the legacy path.
 */
const setLegacyPath = (value: boolean) =>
  useFeatureFlagsStore.setState({ isLoaded: true, flags: { 'notifications-legacy-path': value } });

const resetFlags = () => useFeatureFlagsStore.setState({ isLoaded: false, flags: {} });

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
  // __typename is GraphQL's discriminator, not ours
  return { __typename: typename, ...fields };
}

describe('legacy context rows, on the legacy path', () => {
  beforeEach(() => setLegacyPath(true));
  afterEach(resetFlags);

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

describe('legacy context rows, on the spec path', () => {
  afterEach(resetFlags);

  it('are read for nothing but their plain fields', () => {
    // The exclusivity trade-off, stated as a test: until the backfill has swept these rows,
    // the default path renders them as plain tiles rather than reading a contract it is not on.
    setLegacyPath(false);
    const mapped = mapNotificationNode(
      node({ context: legacyContext('TicketAssignedContext', { type: 'TICKET_ASSIGNED', ticketId: 't-1' }) }),
    );
    expect(mapped.title).toBe('A title');
    expect(mapped.meta?.ticketId).toBeUndefined();
    expect(mapped.meta?.notificationType).toBeUndefined();
    expect(mapped.meta?.contextType).toBeUndefined();
    expect(mapped.type).toBeUndefined();
  });

  it('do not reach the approval tile through context.toolCalls', () => {
    setLegacyPath(false);
    const mapped = mapNotificationNode(
      node({
        category: 'MINGO',
        context: legacyContext('AdminApprovalRequestContext', {
          type: 'ADMIN_APPROVAL_REQUEST',
          approvalRequestId: 'a-1',
          dialogId: 'd-1',
          toolCalls: [{ toolName: 'run_script', requiresApproval: true }],
        }),
      }),
    );
    expect(isApprovalNotification(mapped)).toBe(false);
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

  it('ignores the legacy context entirely on a dual-shape row', () => {
    const mapped = mapNotificationNode(
      node({
        type: 'TICKET_REOPENED',
        attributes: { ticketId: 'from-attributes' },
        context: legacyContext('TicketReopenedContext', {
          type: 'TICKET_REOPENED',
          ticketId: 'from-context',
          dialogId: 'from-context',
        }),
      }),
    );
    expect(mapped.meta?.ticketId).toBe('from-attributes');
    // Not merely outranked — a fact only the unselected shape carries stays absent.
    expect(mapped.meta?.dialogId).toBeUndefined();
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
  const setFlag = setLegacyPath;

  afterEach(resetFlags);

  const dualShapeRow = () =>
    node({
      type: 'TICKET_REOPENED',
      attributes: { ticketId: 'from-attributes' },
      context: legacyContext('TicketReopenedContext', { type: 'TICKET_REOPENED', ticketId: 'from-context' }),
    });

  it('reads attributes while off', () => {
    setFlag(false);
    expect(mapNotificationNode(dualShapeRow()).meta?.ticketId).toBe('from-attributes');
  });

  it('reads the legacy context while on', () => {
    setFlag(true);
    expect(mapNotificationNode(dualShapeRow()).meta?.ticketId).toBe('from-context');
  });

  it('keeps unknown attribute keys off the legacy path', () => {
    // `meta` is spread from the attribute bag, so exclusivity has to hold for keys this
    // release has no code for too — otherwise the unselected contract leaks in wholesale.
    setFlag(true);
    const mapped = mapNotificationNode(
      node({
        type: 'TICKET_STATUS_CHANGED',
        attributes: { ticketId: 'from-attributes', newStatusLabel: 'In Progress' },
        context: legacyContext('TicketStatusChangedContext', {
          type: 'TICKET_STATUS_CHANGED',
          ticketId: 'from-context',
        }),
      }),
    );
    expect(mapped.meta?.newStatusLabel).toBeUndefined();
  });

  it('is off when the server has never heard of the flag', () => {
    // It ships before the backend declares it — an undeclared flag must read as off,
    // not as "unknown", or turning the lever on later would be the only safe state.
    useFeatureFlagsStore.setState({ isLoaded: true, flags: {} });
    expect(mapNotificationNode(dualShapeRow()).meta?.ticketId).toBe('from-attributes');
  });

  it('never falls back to the shape it did not select', () => {
    // Both directions, because both are load-bearing: with the lever ON a spec-only row is
    // not read off `attributes`, and with it OFF a legacy-only row is not read off `context`.
    setFlag(true);
    const specOnly = node({ type: 'TICKET_ASSIGNED', attributes: { ticketId: 't-1' } });
    expect(mapNotificationNode(specOnly).meta?.ticketId).toBeUndefined();
    expect(mapNotificationNode(specOnly).meta?.notificationType).toBeUndefined();

    setFlag(false);
    const legacyOnly = node({
      context: legacyContext('TicketAssignedContext', { type: 'TICKET_ASSIGNED', ticketId: 't-2' }),
    });
    expect(mapNotificationNode(legacyOnly).meta?.ticketId).toBeUndefined();
    expect(mapNotificationNode(legacyOnly).meta?.notificationType).toBeUndefined();
  });

  it('reads approval tool calls from the legacy context while on, not from attributes', () => {
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
