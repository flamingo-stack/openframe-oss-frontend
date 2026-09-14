import { readInlineData } from 'relay-runtime';
import type { deviceFields_machine$data, deviceFields_machine$key } from '@/__generated__/deviceFields_machine.graphql';
import type {
  deviceRowFields_machine$data,
  deviceRowFields_machine$key,
} from '@/__generated__/deviceRowFields_machine.graphql';
import type { deviceSelectorFields_machine$key } from '@/__generated__/deviceSelectorFields_machine.graphql';
import { deviceFieldsFragment } from '@/graphql/devices/device-fields';
import { deviceRowFieldsFragment } from '@/graphql/devices/device-row-fields';
import { deviceSelectorFieldsFragment } from '@/graphql/devices/device-selector-fields';
import type { Device, DeviceTag, ToolConnection, ToolType } from '../types/device.types';

/**
 * A `Machine` flattened to the `Device` the shared device tables, cards and
 * selectors render — one function per step of the field ladder in
 * `src/graphql/devices/`, each reading its own fragment and building on the step
 * below it:
 *
 * - {@link machineRowToDevice} — a table row (`deviceRowFields_machine`)
 * - {@link machineSelectorToDevice} — a row + hardware ids + customer contact
 * - {@link machineToDevice} — the full Devices-page row
 *
 * A caller therefore cannot read a field its query didn't select: the fragment
 * it spread decides which of these three it can call, and the compiler enforces
 * the rest. These are list rows, not the multi-source record `createDevice()`
 * assembles from GraphQL + Fleet + MeshCentral for the detail page.
 */

/**
 * The row step as plain data, with Relay's fragment marker dropped.
 *
 * The one door into these transforms for data that did NOT come from Relay —
 * today the assignments list, which reads its machines through a raw-POST union
 * query (`use-assigned-items.ts`) and so has no fragment reference to hand over.
 * It still has to satisfy this generated shape field for field, which is what
 * keeps that path honest now that the hand-written mirror of it is gone.
 */
export type DeviceRowFields = Omit<deviceRowFields_machine$data, ' $fragmentType'>;

/**
 * A `Tag` as the row step selects it, with everything past the two ids optional
 * — the device DETAIL page still reads its node over raw POST and carries a
 * narrower tag. Derived from the fragment rather than restated, so the field
 * names stay bound to the schema.
 */
type TagFields = NonNullable<NonNullable<DeviceRowFields['tags']>[number]>;
type TagFieldsLike = Partial<TagFields> & Pick<TagFields, 'id' | 'key'>;

/**
 * Maps GraphQL `Tag` nodes to `DeviceTag`, renaming `id` → `tagId`.
 *
 * Relay hands back readonly arrays, so `values` is copied rather than cast.
 */
export function toDeviceTags(tags: ReadonlyArray<TagFieldsLike | null | undefined> | null | undefined): DeviceTag[] {
  return (tags ?? []).flatMap(tag =>
    tag
      ? [
          {
            tagId: tag.id,
            key: tag.key,
            description: tag.description ?? undefined,
            color: tag.color ?? undefined,
            values: [...(tag.values ?? [])],
            createdAt: tag.createdAt ?? undefined,
          },
        ]
      : [],
  );
}

function toToolConnections(connections: deviceFields_machine$data['toolConnections']): ToolConnection[] | undefined {
  if (!connections) return undefined;
  return connections.flatMap(tc =>
    tc
      ? [
          {
            id: tc.id,
            machineId: tc.machineId,
            toolType: tc.toolType as ToolType,
            agentToolId: tc.agentToolId,
            status: tc.status,
            metadata: tc.metadata,
            connectedAt: tc.connectedAt ?? undefined,
            disconnectedAt: tc.disconnectedAt ?? undefined,
          },
        ]
      : [],
  );
}

/** Step 1 — the row fields as data. Split out so the non-Relay path can reach it. */
export function rowFieldsToDevice(machine: DeviceRowFields): Device {
  const hostname = machine.hostname ?? '';

  return {
    // Core Identifiers
    id: machine.id,
    machineId: machine.machineId ?? '',
    hostname,
    displayName: machine.displayName || hostname,

    // Network — no addresses at this step; the shape still requires the array.
    local_ips: [],

    // System Status
    status: machine.status ?? '',
    last_seen: machine.lastSeen ?? undefined,
    lastSeen: machine.lastSeen ?? undefined,

    // Operating System
    platform: machine.osType ?? undefined,
    operating_system: machine.osType ?? undefined,
    osType: machine.osType ?? undefined,

    // Organization
    organizationId: machine.organization?.organizationId ?? undefined,
    organization: machine.organization?.name ?? undefined,
    organizationImageUrl: machine.organization?.image?.imageUrl ?? null,
    organizationImageHash: machine.organization?.image?.hash ?? null,

    tags: toDeviceTags(machine.tags),

    // Misc
    type: machine.type ?? undefined,
  };
}

/** Step 1 — a `deviceRowFields_machine` spread off a device edge. */
export function machineRowToDevice(ref: deviceRowFields_machine$key): Device {
  return rowFieldsToDevice(readInlineData(deviceRowFieldsFragment, ref));
}

/** Step 2 — a row plus the hardware ids and customer contact `DeviceSelector` shows. */
export function machineSelectorToDevice(ref: deviceSelectorFields_machine$key): Device {
  const machine = readInlineData(deviceSelectorFieldsFragment, ref);

  return {
    ...machineRowToDevice(machine),

    // Hardware - Identifiers
    hardware_serial: machine.serialNumber ?? undefined,
    hardware_vendor: machine.manufacturer ?? undefined,
    hardware_model: machine.model ?? undefined,
    serial_number: machine.serialNumber ?? undefined,
    serialNumber: machine.serialNumber ?? undefined,
    manufacturer: machine.manufacturer ?? undefined,
    model: machine.model ?? undefined,

    // A customer can carry several contacts; the column shows one, so take the
    // first that actually has an address.
    organizationEmail: machine.organization?.contactInformation?.contacts?.find(c => c?.email)?.email ?? undefined,
  };
}

/** Step 3 — the full Devices-page row. */
export function machineToDevice(ref: deviceFields_machine$key): Device {
  const machine = readInlineData(deviceFieldsFragment, ref);
  const ip = machine.ip ?? undefined;

  return {
    ...machineSelectorToDevice(machine),

    nickname: machine.nickname ?? undefined,

    // Network
    primary_ip: ip,
    primary_mac: machine.macAddress ?? undefined,
    local_ips: ip ? [ip] : [],
    ip,
    macAddress: machine.macAddress ?? undefined,

    // System Status
    last_enrolled_at: machine.registeredAt ?? undefined,

    // Operating System
    os_version: machine.osVersion ?? undefined,
    build: machine.osBuild ?? undefined,
    osVersion: machine.osVersion ?? undefined,
    osBuild: machine.osBuild ?? undefined,

    // Software & Versions
    agentVersion: machine.agentVersion ?? undefined,

    toolConnections: toToolConnections(machine.toolConnections),

    // Misc
    registeredAt: machine.registeredAt ?? undefined,
    updatedAt: machine.updatedAt ?? undefined,
    osUuid: machine.osUuid ?? undefined,
    timezone: machine.timezone ?? undefined,
  };
}
