import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
import type { ClientDialogOwner, Dialog, DialogOwner } from '../types/dialog.types';

/**
 * A CLIENT-owned ticket carries the machine it was reported from; ADMIN-owned ones
 * carry a user. Narrowed on the discriminant the chat schema sends for both owner
 * kinds (`type`), not on which fields happen to be present.
 */
export function isClientDialogOwner(
  owner: ClientDialogOwner | DialogOwner | null | undefined,
): owner is ClientDialogOwner {
  return owner?.type === 'CLIENT';
}

/**
 * The reporting device's name, resolved like every other screen
 * (nickname → displayName → hostname, see `getDeviceName`).
 *
 * `/chat/graphql` resolves `owner.machine` from the device registry, so its
 * `nickname` is the user-defined name; `deviceHostname` is the hostname
 * denormalized onto the ticket itself and stays the hostname fallback, ahead of
 * the machine's own. Empty string when the ticket has no device at all.
 */
export function getTicketDeviceName(ticket: Pick<Dialog, 'owner' | 'deviceHostname'>): string {
  const machine = isClientDialogOwner(ticket.owner) ? ticket.owner.machine : undefined;
  return getDeviceName({ nickname: machine?.nickname, hostname: ticket.deviceHostname || machine?.hostname });
}
