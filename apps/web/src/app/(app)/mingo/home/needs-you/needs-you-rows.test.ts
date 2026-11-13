/**
 * The "Needs you" block as data: the queue's order (newest first), dedup and dismissals, the
 * counts per category, when it loads, hides or reports a failure, and where each row and quick
 * action leads. Three categories: approvals, NEW critical incidents, escalated tickets.
 */

import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it } from 'vitest';
import type { IncidentRow } from '@/app/(app)/incidents/utils/incident-transform';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import { mingoDialogLink, routes } from '@/lib/routes';
import {
  approvalRow,
  categoryHref,
  criticalIncidentRow,
  epochOf,
  escalatedTicketRow,
  isDismissed,
  type NeedsYouGates,
  needsYouMingoPrompt,
  type NeedsYouReports,
  type NeedsYouRow,
  type NeedsYouSource,
  resolveNeedsYou,
  sameReport,
  type SourceReport,
} from './needs-you-rows';

const ALL_ON: NeedsYouGates = { approvals: 'on', incidents: 'on', tickets: 'on' };

function row(source: NeedsYouSource, id: string, at: number, subjects: string[] = [`${source}:${id}`]): NeedsYouRow {
  return {
    key: `${source}:${id}`,
    entity: 'incident',
    name: id,
    detail: '',
    reason: 'r',
    tone: 'warning',
    href: `/${source}/${id}`,
    at,
    subjects,
  };
}

const ready = (...rows: NeedsYouRow[]): SourceReport => ({ status: 'ready', rows });

/** Rows from every source, their times interleaved across the sources. */
function fullReports(): NeedsYouReports {
  return {
    approvals: ready(row('approvals', '1', 50), row('approvals', '2', 5)),
    incidents: ready(row('incidents', '1', 60), row('incidents', '2', 10)),
    tickets: ready(row('tickets', '1', 40), row('tickets', '2', 15)),
  };
}

const keys = (view: ReturnType<typeof resolveNeedsYou>) => (view.status === 'ready' ? view.queue.map(r => r.key) : []);
const counts = (view: ReturnType<typeof resolveNeedsYou>) =>
  view.status === 'ready' ? Object.fromEntries(view.categories.map(c => [c.category, c.count])) : {};

describe('resolveNeedsYou', () => {
  it('queues every row of the three sources, newest first', () => {
    expect(keys(resolveNeedsYou(ALL_ON, fullReports()))).toEqual([
      'incidents:1',
      'approvals:1',
      'tickets:1',
      'tickets:2',
      'incidents:2',
      'approvals:2',
    ]);
  });

  it("keeps the sources' order between rows of the same time, and puts a row of unknown time last", () => {
    const view = resolveNeedsYou(ALL_ON, {
      ...fullReports(),
      approvals: ready(row('approvals', 'same', 100), row('approvals', 'unknown', 0)),
      incidents: ready(row('incidents', 'same', 100)),
    });
    expect(keys(view).slice(0, 2)).toEqual(['approvals:same', 'incidents:same']);
    expect(keys(view).at(-1)).toBe('approvals:unknown');
  });

  it('counts each category: its own count, else the rows it read', () => {
    const view = resolveNeedsYou(ALL_ON, {
      ...fullReports(),
      incidents: { status: 'ready', rows: [row('incidents', '1', 1)], count: 12 },
    });
    expect(counts(view)).toEqual({ incidents: 12, approvals: 2, tickets: 2 });
    expect(view.status === 'ready' && view.categories.map(c => c.category)).toEqual([
      'incidents',
      'approvals',
      'tickets',
    ]);
  });

  it('skips a source whose gate is off, without waiting for it, and drops its quick action', () => {
    const reports = fullReports();
    delete reports.tickets;
    const view = resolveNeedsYou({ ...ALL_ON, tickets: 'off' }, reports);
    expect(keys(view)).toEqual(['incidents:1', 'approvals:1', 'incidents:2', 'approvals:2']);
    expect(Object.keys(counts(view))).toEqual(['incidents', 'approvals']);
  });

  it('ignores what an off source reported', () => {
    expect(keys(resolveNeedsYou({ ...ALL_ON, incidents: 'off' }, fullReports()))).not.toContain('incidents:1');
  });

  it('loads while a gate is unanswered — never guessed either way', () => {
    expect(resolveNeedsYou({ ...ALL_ON, incidents: 'loading' }, fullReports())).toEqual({ status: 'loading' });
  });

  it('loads while an open source has not answered, even with rows from the others', () => {
    const reports = fullReports();
    delete reports.tickets;
    expect(resolveNeedsYou(ALL_ON, reports)).toEqual({ status: 'loading' });
    expect(resolveNeedsYou(ALL_ON, { ...fullReports(), approvals: { status: 'loading' } })).toEqual({
      status: 'loading',
    });
  });

  it('loads while a count is pending', () => {
    expect(resolveNeedsYou(ALL_ON, fullReports(), { pending: true })).toEqual({ status: 'loading' });
  });

  it('stays up with an empty queue and zero counts once every source answered with nothing', () => {
    const view = resolveNeedsYou(ALL_ON, { approvals: ready(), incidents: ready(), tickets: ready() });
    expect(keys(view)).toEqual([]);
    expect(counts(view)).toEqual({ incidents: 0, approvals: 0, tickets: 0 });
  });

  it('hides when every gate is off', () => {
    expect(resolveNeedsYou({ approvals: 'off', incidents: 'off', tickets: 'off' }, {})).toEqual({ status: 'hidden' });
  });

  it('a failed source is a failure and its category has no count, beside the rows that loaded', () => {
    const retry = () => {};
    const view = resolveNeedsYou(ALL_ON, { ...fullReports(), incidents: { status: 'error', isOffline: false, retry } });
    expect(view.status === 'ready' && view.failures).toEqual([{ source: 'incidents', isOffline: false, retry }]);
    expect(view.status === 'ready' && view.categories.find(c => c.category === 'incidents')).toEqual({
      category: 'incidents',
      count: null,
      failures: [{ source: 'incidents', isOffline: false, retry }],
    });
    expect(keys(view)).not.toContain('incidents:1');
    expect(keys(view)).toContain('tickets:1');
  });

  it('lists a thing once: the newer row about it wins', () => {
    const view = resolveNeedsYou(ALL_ON, {
      ...fullReports(),
      approvals: ready(row('approvals', '1', 90, ['approval:1', 'ticket:7'])),
      tickets: ready(row('tickets', '7', 95, ['ticket:7']), row('tickets', '8', 1, ['ticket:8'])),
      incidents: ready(),
    });
    expect(keys(view)).toEqual(['tickets:7', 'tickets:8']);
  });

  it('leaves out what the user dismissed, and the next row moves up', () => {
    const view = resolveNeedsYou(ALL_ON, fullReports(), { dismissed: { 'incidents:1': 100, 'approvals:1': 100 } });
    expect(keys(view).slice(0, 3)).toEqual(['tickets:1', 'tickets:2', 'incidents:2']);
  });

  it('a dismissed row still counts in its category', () => {
    expect(counts(resolveNeedsYou(ALL_ON, fullReports(), { dismissed: { 'incidents:1': 100 } })).incidents).toBe(2);
  });

  it('a dismissed row about a thing still hides the older row about it', () => {
    const view = resolveNeedsYou(
      ALL_ON,
      {
        ...fullReports(),
        approvals: ready(row('approvals', 'a', 10, ['ticket:a'])),
        tickets: ready(row('tickets', 'a', 80, ['ticket:a'])),
      },
      { dismissed: { 'tickets:a': 100 } },
    );
    expect(keys(view)).not.toContain('approvals:a');
    expect(keys(view)).not.toContain('tickets:a');
  });
});

describe('isDismissed', () => {
  it('hides a row up to the time it was dismissed; one that needs the user again later comes back', () => {
    const r = row('tickets', '1', 1_000);
    expect(isDismissed(r, {})).toBe(false);
    expect(isDismissed(r, { 'tickets:1': 1_000 })).toBe(true);
    expect(isDismissed(r, { 'tickets:1': 2_000 })).toBe(true);
    expect(isDismissed({ ...r, at: 3_000 }, { 'tickets:1': 2_000 })).toBe(false);
  });
});

describe('sameReport', () => {
  it('compares rows by content, not identity', () => {
    expect(sameReport(ready(row('tickets', '1', 1)), ready(row('tickets', '1', 1)))).toBe(true);
    expect(sameReport(ready(row('tickets', '1', 1)), ready(row('tickets', '2', 1)))).toBe(false);
    expect(sameReport(ready(row('tickets', '1', 1)), ready(row('tickets', '1', 2)))).toBe(false);
    expect(sameReport({ status: 'ready', rows: [], count: 1 }, { status: 'ready', rows: [], count: 2 })).toBe(false);
    expect(sameReport(undefined, { status: 'loading' })).toBe(false);
    expect(sameReport({ status: 'loading' }, ready())).toBe(false);
  });
});

describe('categoryHref', () => {
  const ids = { techRequiredStatusIds: ['s-1', 's-2'] };
  it('opens each category page, narrowed to what the count counts where the page reads it', () => {
    expect(categoryHref('incidents', ids)).toBe(routes.incidents.filtered({ severity: ['CRITICAL'], status: ['NEW'] }));
    expect(categoryHref('approvals', ids)).toBe(routes.approvals);
    expect(categoryHref('tickets', ids)).toBe(routes.tickets.filtered({ status: ['s-1', 's-2'] }));
  });

  it('the whole tickets list while the Tech Required statuses are unknown', () => {
    expect(categoryHref('tickets', { techRequiredStatusIds: [] })).toBe(routes.tickets.list);
  });
});

describe('epochOf', () => {
  it('reads an Instant or epoch ms, and 0 for nothing or garbage', () => {
    expect(epochOf('2026-10-16T08:00:00Z')).toBe(Date.UTC(2026, 9, 16, 8));
    expect(epochOf(1_234)).toBe(1_234);
    expect(epochOf(null)).toBe(0);
    expect(epochOf(undefined)).toBe(0);
    expect(epochOf('not a date')).toBe(0);
    expect(epochOf(Number.NaN)).toBe(0);
  });
});

describe('needsYouMingoPrompt', () => {
  it('tells Mingo what the item is, why, what else is known and where it is', () => {
    expect(
      needsYouMingoPrompt({
        ...row('tickets', '1', 1),
        entity: 'ticket',
        name: '1003: VPN down',
        reason: 'Escalated by user',
        detail: 'Acme · host-9',
        href: '/tickets/dialog?id=t-9',
      }),
    ).toBe(
      'Ticket "1003: VPN down" needs my attention (escalated by user).\nDetails: Acme · host-9.\nPage: /tickets/dialog?id=t-9\nHelp me resolve it.',
    );
  });

  it('leaves out the details it does not have', () => {
    expect(
      needsYouMingoPrompt({ ...row('incidents', '1', 1), entity: 'incident', name: 'Disk full', reason: 'Critical' }),
    ).not.toContain('Details');
  });
});

function approval(meta: Record<string, unknown>, overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    title: '1152 - Printer Not Working',
    description: 'Restart the print spooler.',
    createdAt: 0,
    meta: { approvalRequestId: 'a-1', toolCalls: [{ toolName: 'runCommand' }], resolution: 'PENDING', ...meta },
    ...overrides,
  };
}

describe('row builders', () => {
  it('a ticket approval opens its ticket and stands for it', () => {
    const result = approvalRow(approval({ notificationType: 'TICKET_APPROVAL_REQUEST', ticketId: 't-1' }));
    expect(result).toMatchObject({
      name: '1152 - Printer Not Working',
      detail: 'Restart the print spooler.',
      reason: 'Needs approval',
      tone: 'warning',
      href: routes.tickets.dialog('t-1'),
      at: 0,
      subjects: ['approval:a-1', 'ticket:t-1'],
    });
    expect(
      approvalRow(approval({ notificationType: 'TICKET_APPROVAL_REQUEST', ticketId: 't-1' }, { createdAt: 42 }))?.at,
    ).toBe(42);
  });

  it('a Mingo approval opens its chat', () => {
    const result = approvalRow(approval({ notificationType: 'MINGO_APPROVAL_REQUEST', dialogId: 'd-1' }));
    expect(result?.href).toBe(mingoDialogLink('d-1'));
  });

  it("names a Mingo request the backend left as 'Approval required': its chat, else its first action", () => {
    const untitled = (dialogId: string) =>
      approval(
        {
          notificationType: 'MINGO_APPROVAL_REQUEST',
          dialogId,
          toolCalls: [{ toolName: 'runCommand', toolTitle: 'Run command' }],
        },
        { title: 'Approval required' },
      );
    expect(approvalRow(untitled('d-1'), { 'd-1': 'Disk Space Cleanup' })?.name).toBe('Disk Space Cleanup');
    expect(approvalRow(untitled('d-gone'), { 'd-1': 'Disk Space Cleanup' })?.name).toBe('Run command');
  });

  it('skips a decided approval and a notification that is not one', () => {
    expect(
      approvalRow(approval({ notificationType: 'TICKET_APPROVAL_REQUEST', ticketId: 't-1', resolution: 'APPROVED' })),
    ).toBeNull();
    expect(approvalRow(approval({ notificationType: 'TICKET_ASSIGNED', ticketId: 't-1' }))).toBeNull();
  });

  const incident: IncidentRow = {
    id: 'SW5zaWdodDox',
    insightId: 'i-1',
    title: 'Disk is almost full',
    type: 'IT',
    severity: 'CRITICAL',
    status: 'NEW',
    snoozedUntil: null,
    detectedAt: '2026-10-16T08:00:00Z',
    machineId: 'm-1',
    hasDevice: true,
    deviceName: 'LAPTOP-1',
    deviceType: 'laptop',
    organizationId: 'o-1',
    organizationName: 'Acme',
    assignee: null,
  };

  it('a critical incident opens the incident', () => {
    expect(criticalIncidentRow(incident)).toMatchObject({
      name: 'Disk is almost full',
      detail: 'LAPTOP-1 · Acme',
      reason: 'Critical',
      tone: 'critical',
      href: routes.incidents.details('SW5zaWdodDox'),
      at: Date.UTC(2026, 9, 16, 8),
    });
  });

  it('an escalated ticket opens the ticket', () => {
    const ticket: Dialog = {
      id: 't-9',
      title: 'VPN down',
      ticketNumber: 1003,
      organizationName: 'Acme',
      deviceHostname: 'host-9',
      owner: { type: 'CLIENT', machineId: 'm-9' },
      createdAt: '2026-10-01T00:00:00Z',
      statusUpdatedAt: '2026-10-02T00:00:00Z',
    } as Dialog;
    expect(escalatedTicketRow(ticket)).toMatchObject({
      name: '1003: VPN down',
      detail: 'Acme · host-9',
      reason: 'Escalated by user',
      tone: 'warning',
      href: routes.tickets.dialog('t-9'),
      at: Date.UTC(2026, 9, 1),
      subjects: ['ticket:t-9'],
    });
    // Not the last update of any kind (`statusUpdatedAt`): an edit does not make an old ticket new.
    expect(escalatedTicketRow({ ...ticket, statusUpdatedAt: '2026-11-01T00:00:00Z' }).at).toBe(Date.UTC(2026, 9, 1));
  });
});
