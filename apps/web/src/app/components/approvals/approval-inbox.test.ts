/**
 * The Needs approval page's one list, composed from the drawer's notifications, the Mingo
 * chats waiting on an approval and the Tech Required lane: one card per approval request,
 * nothing a technician cannot decide, nothing already decided, and no tickets where
 * tickets do not exist.
 */

import type { Notification } from '@flamingo-stack/openframe-frontend-core/components/features';
import { getApprovalMeta } from '@flamingo-stack/openframe-frontend-core/components/features';
import { describe, expect, it } from 'vitest';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import type { ApprovalDialogNode } from './approval-dialogs-query';
import { composeApprovalInbox, decidedCard, type ApprovalSources, techRequiredStatusId } from './approval-inbox';

const TOOL_CALL = {
  toolExecutionRequestId: 'te-1',
  toolName: 'run_script',
  toolTitle: 'Restart spooler',
  toolExplanation: 'Restarts the print spooler',
  toolType: 'OPENFRAME_SCRIPT',
  requiresApproval: true,
  approvalType: 'ADMIN',
  toolCallArguments: { script: 'Restart-Service Spooler' },
};

function approvalNotification(
  id: string,
  approvalRequestId: string,
  extra: Record<string, unknown> = {},
  fields: Partial<Notification> = {},
): Notification {
  return {
    id,
    title: 'Approval required',
    description: 'Restarts the print spooler',
    createdAt: Date.parse('2026-10-16T10:00:00Z'),
    read: false,
    category: 'MINGO',
    meta: {
      notificationType: 'MINGO_APPROVAL_REQUEST',
      approvalRequestId,
      approvalType: 'ADMIN',
      resolution: 'PENDING',
      toolCalls: [TOOL_CALL],
      ...extra,
    },
    ...fields,
  };
}

function chat(
  dialogId: string,
  approvalRequestId: string,
  overrides: Partial<ApprovalDialogNode> = {},
): ApprovalDialogNode {
  return {
    id: `g-${dialogId}`,
    dialogId,
    title: `Chat ${dialogId}`,
    createdAt: '2026-10-16T09:00:00.123456789Z',
    pendingApproval: {
      id: approvalRequestId,
      approvalType: 'ADMIN',
      explanation: null,
      createdAt: '2026-10-16T09:30:00Z',
      toolCalls: [TOOL_CALL],
    },
    ...overrides,
  };
}

function ticket(id: string, approvalRequestId: string | null, overrides: Partial<Dialog> = {}): Dialog {
  return {
    id,
    title: 'Customer Service Request',
    ticketNumber: 1152,
    dialogId: `fae-${id}`,
    owner: { type: 'ADMIN' },
    createdAt: '2026-10-15T08:00:00Z',
    statusUpdatedAt: null,
    resolvedAt: null,
    aiResolutionSuggestedAt: null,
    rating: null,
    organizationName: 'Acme',
    deviceHostname: 'LAPTOP-7',
    pendingApproval: approvalRequestId
      ? { id: approvalRequestId, approvalType: 'ADMIN', createdAt: '2026-10-16T08:00:00Z', toolCalls: [TOOL_CALL] }
      : undefined,
    ...overrides,
  } as Dialog;
}

function sources(overrides: Partial<ApprovalSources> = {}): ApprovalSources {
  return { notifications: [], dialogs: [], tickets: [], decisions: {}, ...overrides };
}

const ids = (cards: { approvalRequestId: string }[]) => cards.map(card => card.approvalRequestId);

describe('composeApprovalInbox', () => {
  it('shows one card per approval request: the notification, named after its chat', () => {
    const inbox = composeApprovalInbox(
      sources({
        notifications: [approvalNotification('n-1', 'ar-1', { dialogId: 'd-1' })],
        dialogs: [chat('d-1', 'ar-1'), chat('d-2', 'ar-2')],
      }),
    );

    expect(ids(inbox.cards)).toEqual(['ar-1', 'ar-2']);
    const [fromNotification, fromChat] = inbox.cards;
    expect(fromNotification.notificationId).toBe('n-1');
    expect(fromNotification.notification.title).toBe('Chat d-1');
    expect(fromChat.notificationId).toBeNull();
    expect(fromChat.dialogId).toBe('d-2');
    expect(fromChat.notification.type).toBe('Mingo Approval Request');
    expect(fromChat.notification.description).toBe('Restarts the print spooler');
    // The chat's request carries everything the tile's command section reads.
    expect(getApprovalMeta(fromChat.notification)?.toolCalls[0].toolCallArguments).toEqual({
      script: 'Restart-Service Spooler',
    });
    expect(inbox.pendingCount).toBe(2);
  });

  it('lists a waiting ticket once: as its notification when there is one', () => {
    const inbox = composeApprovalInbox(
      sources({
        notifications: [
          approvalNotification(
            'n-1',
            'ar-t1',
            { notificationType: 'TICKET_APPROVAL_REQUEST', ticketId: 't-1' },
            { category: 'TICKETS', title: '1152 - Customer Service Request' },
          ),
        ],
        tickets: [ticket('t-1', 'ar-t1'), ticket('t-2', 'ar-t2'), ticket('t-3', null)],
      }),
    );

    expect(ids(inbox.cards)).toEqual(['ar-t1', 'ar-t2']);
    expect(inbox.cards[0].notificationId).toBe('n-1');
    expect(inbox.cards[1].notificationId).toBeNull();
    expect(inbox.pendingCount).toBe(2);
  });

  it('draws a waiting ticket as the request its notification would have been', () => {
    const [card] = composeApprovalInbox(sources({ tickets: [ticket('t-2', 'ar-t2')] })).cards;

    expect(card.notification.type).toBe('Ticket Approval Request');
    expect(card.notification.title).toBe('1152: Customer Service Request');
    expect(card.notification.description).toBe('LAPTOP-7 · Acme');
    expect(card.ticketId).toBe('t-2');
    expect(getApprovalMeta(card.notification)?.ticketId).toBe('t-2');

    const [bare] = composeApprovalInbox(
      sources({ tickets: [ticket('t-4', 'ar-t4', { deviceHostname: undefined, organizationName: undefined })] }),
    ).cards;
    expect(bare.notification.description).toBe('No device · No customer');
  });

  it('leaves out what a technician cannot decide or no longer has to', () => {
    const inbox = composeApprovalInbox(
      sources({
        notifications: [
          approvalNotification('n-read', 'ar-read', {}, { read: true }),
          approvalNotification('n-done', 'ar-done', { resolution: 'APPROVED' }),
          approvalNotification('n-cancelled', 'ar-cancelled', { resolution: 'CANCELLED' }),
          { id: 'n-plain', title: 'Ticket assigned', createdAt: 1, meta: { notificationType: 'TICKET_ASSIGNED' } },
        ],
        dialogs: [chat('d-none', 'x', { pendingApproval: null })],
        tickets: [ticket('t-client', null, { pendingApproval: { id: 'ar-client', approvalType: 'CLIENT' } })],
      }),
    );

    expect(inbox.cards).toEqual([]);
    expect(inbox.pendingCount).toBe(0);
  });

  it('has no tickets where tickets do not exist', () => {
    const inbox = composeApprovalInbox(
      sources({ notifications: [approvalNotification('n-1', 'ar-1')], tickets: null }),
    );

    expect(ids(inbox.cards)).toEqual(['ar-1']);
    expect(inbox.pendingCount).toBe(1);
  });

  it('drops a request once any surface decided it, and keeps the one decided on the page', () => {
    const live = sources({
      dialogs: [chat('d-1', 'ar-1'), chat('d-2', 'ar-2')],
      tickets: [ticket('t-1', 'ar-t1')],
    });
    const before = composeApprovalInbox(live);
    expect(before.pendingCount).toBe(3);

    const decided = composeApprovalInbox({ ...live, decisions: { 'ar-2': 'rejected', 'ar-t1': 'approved' } });
    expect(ids(decided.cards)).toEqual(['ar-1']);
    expect(decided.pendingCount).toBe(1);

    const [waiting] = before.cards.filter(card => card.approvalRequestId === 'ar-t1');
    const kept = { 'ar-t1': decidedCard(waiting, 'approved', 'Ann Lee') };
    const onPage = composeApprovalInbox({ ...live, tickets: [], decisions: { 'ar-t1': 'approved' } }, kept);
    const [keptCard] = onPage.cards.filter(card => card.approvalRequestId === 'ar-t1');
    expect(keptCard.pending).toBe(false);
    expect(onPage.pendingCount).toBe(2);
    expect(getApprovalMeta(keptCard.notification)).toMatchObject({
      resolution: 'APPROVED',
      resolvedByName: 'Ann Lee',
    });
  });

  it('puts the newest request first', () => {
    const inbox = composeApprovalInbox(
      sources({
        notifications: [approvalNotification('n-1', 'ar-old', {}, { createdAt: Date.parse('2026-10-16T08:00:00Z') })],
        dialogs: [chat('d-2', 'ar-new')],
      }),
    );
    expect(ids(inbox.cards)).toEqual(['ar-new', 'ar-old']);
  });
});

describe('techRequiredStatusId', () => {
  it('is the system Tech Required status, not a custom one of the same kind', () => {
    const status = (id: string, kind: string, isSystem: boolean) =>
      ({ id, kind, isSystem, name: id, color: '#fff', position: 'a', staleAfterMinutes: 120 }) as never;
    expect(techRequiredStatusId([status('s-1', 'AI_ASSISTANCE', true), status('s-2', 'TECH_REQUIRED', true)])).toBe(
      's-2',
    );
    expect(techRequiredStatusId([status('s-3', 'CUSTOM', false)])).toBeNull();
    expect(techRequiredStatusId(undefined)).toBeNull();
  });
});
