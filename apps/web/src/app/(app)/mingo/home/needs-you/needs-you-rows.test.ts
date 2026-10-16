/**
 * The "Needs you" card as data: the order and caps of its rows, when it loads, hides or
 * reports a failure, the footer line, and where each kind of row leads.
 */

import type { Notification } from '@flamingo-stack/openframe-frontend-core';
import { describe, expect, it } from 'vitest';
import type { IncidentRow } from '@/app/(app)/incidents/utils/incident-transform';
import type { Dialog } from '@/app/(app)/tickets/types/dialog.types';
import { mingoDialogLink, routes } from '@/lib/routes';
import {
  approvalRow,
  criticalIncidentRow,
  diskWarningRow,
  escalatedTicketRow,
  failedSoftwareActionRow,
  failedSyncTenantRow,
  type NeedsYouGates,
  type NeedsYouReports,
  type NeedsYouRow,
  type NeedsYouSource,
  needsYouFooter,
  resolveNeedsYou,
  sameReport,
  type SourceReport,
} from './needs-you-rows';

const ALL_ON: NeedsYouGates = {
  approvals: 'on',
  incidents: 'on',
  tickets: 'on',
  tenants: 'on',
  software: 'on',
  disk: 'on',
};

function row(source: NeedsYouSource, id: string, subjects: string[] = [`${source}:${id}`]): NeedsYouRow {
  return {
    key: `${source}:${id}`,
    entity: 'incident',
    name: id,
    detail: '',
    reason: 'r',
    tone: 'warning',
    href: `/${source}/${id}`,
    subjects,
  };
}

const ready = (...rows: NeedsYouRow[]): SourceReport => ({ status: 'ready', rows });

/** Three candidates from every source — more than any cap. */
function fullReports(): NeedsYouReports {
  const reports: NeedsYouReports = {};
  for (const source of ['approvals', 'incidents', 'tickets', 'tenants', 'software', 'disk'] as const) {
    reports[source] = ready(row(source, '1'), row(source, '2'), row(source, '3'));
  }
  return reports;
}

const keys = (view: ReturnType<typeof resolveNeedsYou>) => (view.status === 'ready' ? view.rows.map(r => r.key) : []);

describe('resolveNeedsYou', () => {
  it('lists the sources in order, each up to its cap', () => {
    expect(keys(resolveNeedsYou(ALL_ON, fullReports()))).toEqual([
      'approvals:1',
      'approvals:2',
      'incidents:1',
      'incidents:2',
      'tickets:1',
      'tickets:2',
      'tenants:1',
      'software:1',
      'disk:1',
    ]);
  });

  it('skips a source whose gate is off, without waiting for it', () => {
    const gates: NeedsYouGates = { ...ALL_ON, tickets: 'off', tenants: 'off' };
    const reports = fullReports();
    delete reports.tickets;
    delete reports.tenants;
    expect(keys(resolveNeedsYou(gates, reports))).toEqual([
      'approvals:1',
      'approvals:2',
      'incidents:1',
      'incidents:2',
      'software:1',
      'disk:1',
    ]);
  });

  it('ignores what an off source reported', () => {
    expect(keys(resolveNeedsYou({ ...ALL_ON, software: 'off' }, fullReports()))).not.toContain('software:1');
  });

  it('loads while a gate is unanswered — never guessed either way', () => {
    expect(resolveNeedsYou({ ...ALL_ON, incidents: 'loading' }, fullReports())).toEqual({ status: 'loading' });
  });

  it('loads while an open source has not answered, even with rows from the others', () => {
    const reports = fullReports();
    delete reports.disk;
    expect(resolveNeedsYou(ALL_ON, reports)).toEqual({ status: 'loading' });
    expect(resolveNeedsYou(ALL_ON, { ...fullReports(), tenants: { status: 'loading' } })).toEqual({
      status: 'loading',
    });
  });

  it('loads while the footer counts are pending', () => {
    expect(resolveNeedsYou(ALL_ON, fullReports(), true)).toEqual({ status: 'loading' });
  });

  it('hides once every source answered with nothing', () => {
    const empty: NeedsYouReports = {
      approvals: ready(),
      incidents: ready(),
      tickets: ready(),
      tenants: ready(),
      software: ready(),
      disk: ready(),
    };
    expect(resolveNeedsYou(ALL_ON, empty)).toEqual({ status: 'hidden' });
  });

  it('hides when every gate is off', () => {
    const off: NeedsYouGates = {
      approvals: 'off',
      incidents: 'off',
      tickets: 'off',
      tenants: 'off',
      software: 'off',
      disk: 'off',
    };
    expect(resolveNeedsYou(off, {})).toEqual({ status: 'hidden' });
  });

  it('keeps the card up with a failure instead of claiming nothing needs the user', () => {
    const retry = () => {};
    const view = resolveNeedsYou(
      { ...ALL_ON, incidents: 'off', disk: 'off' },
      {
        approvals: ready(),
        tickets: ready(),
        tenants: { status: 'error', isOffline: false, retry },
        software: ready(),
      },
    );
    expect(view).toEqual({ status: 'ready', rows: [], failures: [{ source: 'tenants', isOffline: false, retry }] });
  });

  it('lists a thing once: a later row about it gives way to the next candidate', () => {
    const view = resolveNeedsYou(ALL_ON, {
      ...fullReports(),
      approvals: ready(row('approvals', '1', ['approval:1', 'ticket:7'])),
      tickets: ready(
        row('tickets', '7', ['ticket:7']),
        row('tickets', '8', ['ticket:8']),
        row('tickets', '9', ['ticket:9']),
      ),
      incidents: ready(row('incidents', 'a', ['insight:a'])),
      disk: ready(row('disk', 'a', ['insight:a']), row('disk', 'b', ['insight:b'])),
    });
    expect(keys(view)).toEqual([
      'approvals:1',
      'incidents:a',
      'tickets:8',
      'tickets:9',
      'tenants:1',
      'software:1',
      'disk:b',
    ]);
  });
});

describe('needsYouFooter', () => {
  it('prints the three counts', () => {
    expect(needsYouFooter({ aiHandled: 3, needTechnician: 2, newIncidents: 4 })).toBe(
      '3 tickets handled by AI · 2 need a technician · 4 new incidents',
    );
    expect(needsYouFooter({ aiHandled: 1, needTechnician: 1, newIncidents: 1 })).toBe(
      '1 ticket handled by AI · 1 needs a technician · 1 new incident',
    );
  });

  it('leaves out what is gated off or unknown', () => {
    expect(needsYouFooter({ aiHandled: null, needTechnician: null, newIncidents: 0 })).toBe('0 new incidents');
    expect(needsYouFooter({ aiHandled: 5, needTechnician: 0, newIncidents: null })).toBe(
      '5 tickets handled by AI · 0 need a technician',
    );
    expect(needsYouFooter({ aiHandled: null, needTechnician: null, newIncidents: null })).toBeNull();
  });
});

describe('sameReport', () => {
  it('compares rows by content, not identity', () => {
    expect(sameReport(ready(row('tenants', '1')), ready(row('tenants', '1')))).toBe(true);
    expect(sameReport(ready(row('tenants', '1')), ready(row('tenants', '2')))).toBe(false);
    expect(sameReport({ status: 'ready', rows: [], count: 1 }, { status: 'ready', rows: [], count: 2 })).toBe(false);
    expect(sameReport(undefined, { status: 'loading' })).toBe(false);
    expect(sameReport({ status: 'loading' }, ready())).toBe(false);
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
      subjects: ['approval:a-1', 'ticket:t-1'],
    });
  });

  it('a Mingo approval opens its chat', () => {
    const result = approvalRow(approval({ notificationType: 'MINGO_APPROVAL_REQUEST', dialogId: 'd-1' }));
    expect(result?.href).toBe(mingoDialogLink('d-1'));
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
      tone: 'error',
      href: routes.incidents.details('SW5zaWdodDox'),
    });
  });

  it('a disk warning opens the device, or the finding when the device is gone', () => {
    expect(diskWarningRow(incident)).toMatchObject({
      entity: 'device',
      name: 'LAPTOP-1',
      reason: 'Low disk space',
      tone: 'warning',
      href: routes.devices.details('m-1'),
    });
    expect(diskWarningRow({ ...incident, hasDevice: false }).href).toBe(routes.incidents.details('SW5zaWdodDox'));
  });

  it('an escalated ticket opens the ticket', () => {
    const ticket: Dialog = {
      id: 't-9',
      title: 'VPN down',
      ticketNumber: 1003,
      organizationName: 'Acme',
      deviceHostname: 'host-9',
      owner: { type: 'CLIENT', machineId: 'm-9' },
    } as Dialog;
    expect(escalatedTicketRow(ticket)).toMatchObject({
      name: '1003: VPN down',
      detail: 'Acme · host-9',
      reason: 'Escalated by user',
      tone: 'error',
      href: routes.tickets.dialog('t-9'),
      subjects: ['ticket:t-9'],
    });
  });

  it('a failed sync opens the cloud tenant', () => {
    expect(
      failedSyncTenantRow({ id: 'c-1', name: 'Acme M365', provider: 'MICROSOFT_365', customerName: 'Acme' }),
    ).toMatchObject({
      detail: 'Microsoft 365 · Acme',
      reason: 'Sync failed',
      tone: 'error',
      href: routes.cloudTenantManagement.details('c-1'),
    });
  });

  it('a failed software action opens the action', () => {
    expect(
      failedSoftwareActionRow({
        id: 'sa-1',
        software: 'Firefox',
        action: 'INSTALL',
        engine: 'WINGET',
        respondedMachineCount: 2,
        totalMachineCount: 5,
      }),
    ).toMatchObject({ reason: 'Failed', tone: 'error', href: routes.software.action('sa-1') });
  });
});
