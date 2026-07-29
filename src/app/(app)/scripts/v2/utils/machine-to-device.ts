import type { Device } from '@/app/(app)/devices/types/device.types';

/**
 * The shape every schedule-side `Machine` selection has in common.
 *
 * Structural rather than a generated type: the assigned-devices tab, the
 * picker's Available list and its Selected list are three different Relay
 * operations over the same record, each selecting a little more or less. Every
 * field past the two ids is optional so a caller can pass whichever of them it
 * has, and Relay's readonly arrays are accepted as-is.
 */
export interface MachineLike {
  readonly id: string;
  readonly machineId: string;
  readonly hostname?: string | null;
  readonly displayName?: string | null;
  readonly status?: string | null;
  readonly lastSeen?: string | null;
  readonly type?: string | null;
  readonly osType?: string | null;
  readonly manufacturer?: string | null;
  readonly model?: string | null;
  readonly serialNumber?: string | null;
  readonly organization?: {
    readonly organizationId?: string | null;
    readonly name?: string | null;
    readonly image?: { readonly imageUrl?: string | null; readonly hash?: string | null } | null;
    readonly contactInformation?: {
      readonly contacts?: ReadonlyArray<{ readonly email?: string | null } | null> | null;
    } | null;
  } | null;
  readonly tags?: ReadonlyArray<
    | {
        readonly id: string;
        readonly key: string;
        readonly values?: ReadonlyArray<string> | null;
      }
    | null
    | undefined
  > | null;
}

/**
 * Adapts a Machine node to the `Device` the shared device tables render.
 *
 * Only the fields those tables read are populated — this is a list row, not the
 * full multi-source record `createDevice()` assembles from GraphQL + Fleet +
 * MeshCentral. `local_ips` is required by the type and unavailable here, hence
 * the empty array.
 */
export function machineToDevice(machine: MachineLike): Device {
  return {
    id: machine.id,
    machineId: machine.machineId,
    hostname: machine.hostname ?? '',
    displayName: machine.displayName ?? machine.hostname ?? '',
    status: machine.status ?? '',
    local_ips: [],
    last_seen: machine.lastSeen ?? undefined,
    lastSeen: machine.lastSeen ?? undefined,
    type: machine.type ?? undefined,
    osType: machine.osType ?? undefined,
    manufacturer: machine.manufacturer ?? undefined,
    model: machine.model ?? undefined,
    serialNumber: machine.serialNumber ?? undefined,
    serial_number: machine.serialNumber ?? undefined,
    organizationId: machine.organization?.organizationId ?? undefined,
    organization: machine.organization?.name ?? undefined,
    // A customer can carry several contacts; the column shows one, so take the
    // first that actually has an address.
    organizationEmail: machine.organization?.contactInformation?.contacts?.find(c => c?.email)?.email ?? undefined,
    organizationImageUrl: machine.organization?.image?.imageUrl ?? null,
    organizationImageHash: machine.organization?.image?.hash ?? null,
    // Relay hands back readonly arrays; `DeviceTag` is mutable, so copy rather
    // than cast.
    tags: (machine.tags ?? []).flatMap(tag =>
      tag ? [{ tagId: tag.id, key: tag.key, values: [...(tag.values ?? [])] }] : [],
    ),
  };
}
