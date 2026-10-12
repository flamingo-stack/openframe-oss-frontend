import { describe, expect, it } from 'vitest';
import { assignedTargetIds } from './assigned-target-ids';

const globalId = (typename: string, rawId: string) => btoa(`${typename}:${rawId}`);

const ORG_1 = globalId('Organization', 'org-1');
const ORG_2 = globalId('Organization', 'org-2');
const DEVICE_1 = globalId('Machine', 'device-1');

describe('assignedTargetIds', () => {
  it('lists every kind that has something assigned when there is nothing stored', () => {
    expect(
      assignedTargetIds({
        ORGANIZATION: [{ id: ORG_1, label: 'Acme' }],
        DEVICE: [{ id: DEVICE_1, label: 'Laptop' }],
        TICKET: [],
      }),
    ).toEqual({ assignedOrganizationIds: [ORG_1], assignedDeviceIds: [DEVICE_1] });
  });

  it('leaves out a kind that is as it was stored, whatever the order', () => {
    const stored = { ORGANIZATION: [ORG_1, ORG_2].map(id => ({ id, label: id })) };
    const next = { ORGANIZATION: [ORG_2, ORG_1].map(id => ({ id, label: id })) };

    expect(assignedTargetIds(next, stored)).toEqual({});
  });

  it('sends an emptied kind as an empty list — that is what unassigns everything', () => {
    const stored = { ORGANIZATION: [{ id: ORG_1, label: 'Acme' }], DEVICE: [{ id: DEVICE_1, label: 'Laptop' }] };
    const next = { DEVICE: [{ id: DEVICE_1, label: 'Laptop' }] };

    expect(assignedTargetIds(next, stored)).toEqual({ assignedOrganizationIds: [] });
  });

  it('sends the whole list of a kind that changed', () => {
    const stored = { ORGANIZATION: [{ id: ORG_1, label: 'Acme' }] };
    const next = { ORGANIZATION: [ORG_1, ORG_2].map(id => ({ id, label: id })) };

    expect(assignedTargetIds(next, stored)).toEqual({ assignedOrganizationIds: [ORG_1, ORG_2] });
  });

  it('turns a raw ticket id into a global one', () => {
    expect(assignedTargetIds({ TICKET: [{ id: '65f0c0ffee0000000000abcd', label: '#12' }] })).toEqual({
      assignedTicketIds: [globalId('Ticket', '65f0c0ffee0000000000abcd')],
    });
  });

  it('never sends the client-only incident row', () => {
    expect(assignedTargetIds({ INSIGHT: [{ id: 'insight-1', label: 'Disk full' }] })).toEqual({});
  });
});
