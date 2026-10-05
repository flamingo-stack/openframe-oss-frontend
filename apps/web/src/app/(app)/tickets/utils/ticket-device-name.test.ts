import { describe, expect, it } from 'vitest';
import { getTicketDeviceName, isClientDialogOwner } from './ticket-device-name';

const clientOwner = {
  type: 'CLIENT' as const,
  machineId: 'm-1',
  machine: { id: 'm-1', machineId: 'm-1', hostname: 'Mac', nickname: 'Scrappy', organizationId: 'org-1' },
};
const adminOwner = { type: 'ADMIN' as const };

describe('isClientDialogOwner', () => {
  it('recognises a CLIENT owner by its machineId', () => {
    expect(isClientDialogOwner(clientOwner)).toBe(true);
    expect(isClientDialogOwner(adminOwner)).toBe(false);
    expect(isClientDialogOwner(undefined)).toBe(false);
  });
});

describe('getTicketDeviceName', () => {
  it('puts the machine nickname first, like every other device screen', () => {
    expect(getTicketDeviceName({ owner: clientOwner, deviceHostname: 'Mac' })).toBe('Scrappy');
  });

  it('falls back to the ticket hostname when the machine has no nickname', () => {
    const owner = { ...clientOwner, machine: { ...clientOwner.machine, nickname: null } };
    expect(getTicketDeviceName({ owner, deviceHostname: 'Mac' })).toBe('Mac');
  });

  it('prefers the ticket hostname over the machine hostname (the ticket carries its own)', () => {
    const owner = { ...clientOwner, machine: { ...clientOwner.machine, nickname: null, hostname: 'machine-host' } };
    expect(getTicketDeviceName({ owner, deviceHostname: 'ticket-host' })).toBe('ticket-host');
    expect(getTicketDeviceName({ owner, deviceHostname: undefined })).toBe('machine-host');
  });

  it('still names the device when the machine did not resolve but the ticket kept the hostname', () => {
    expect(getTicketDeviceName({ owner: { ...clientOwner, machine: undefined }, deviceHostname: 'Mac' })).toBe('Mac');
  });

  it('is empty for an ADMIN-owned ticket with no device', () => {
    expect(getTicketDeviceName({ owner: adminOwner, deviceHostname: undefined })).toBe('');
  });
});
