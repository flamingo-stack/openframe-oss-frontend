import type { Device, DeviceTag, ToolConnection, ToolType } from '../types/device.types';

/** The GraphQL `Tag` node shape, as selected by every device document. */
interface TagNode {
  readonly id: string;
  readonly key: string;
  readonly description?: string | null;
  readonly color?: string | null;
  readonly values?: readonly string[] | null;
  readonly createdAt?: string | null;
}

/** The GraphQL `ToolConnection` node shape. */
interface ToolConnectionNode {
  readonly id: string;
  readonly machineId: string;
  readonly toolType: string;
  readonly agentToolId: string;
  readonly status: string;
  readonly metadata?: unknown;
  readonly connectedAt?: string | null;
  readonly lastSyncAt?: string | null;
  readonly disconnectedAt?: string | null;
}

/**
 * A GraphQL `Machine` node, as any device document selects it.
 *
 * Structural rather than a generated type, and everything past the two ids is
 * optional, because the selections differ: the Devices list takes the whole row,
 * the schedule tables take a subset. A caller passes whatever it selected and
 * gets a `Device` with the rest left undefined.
 *
 * Every field accepts `null` and readonly arrays so Relay's generated types fit
 * without casts, and plain mutable objects (the react-query paths) fit too.
 */
export interface MachineLike {
  readonly id: string;
  readonly machineId?: string | null;
  readonly hostname?: string | null;
  readonly displayName?: string | null;
  readonly ip?: string | null;
  readonly macAddress?: string | null;
  readonly osUuid?: string | null;
  readonly agentVersion?: string | null;
  readonly status?: string | null;
  readonly lastSeen?: string | null;
  readonly serialNumber?: string | null;
  readonly manufacturer?: string | null;
  readonly model?: string | null;
  readonly type?: string | null;
  readonly osType?: string | null;
  readonly osVersion?: string | null;
  readonly osBuild?: string | null;
  readonly timezone?: string | null;
  readonly registeredAt?: string | null;
  readonly updatedAt?: string | null;
  readonly organization?: {
    readonly organizationId?: string | null;
    readonly name?: string | null;
    readonly image?: { readonly imageUrl?: string | null; readonly hash?: string | null } | null;
    readonly contactInformation?: {
      readonly contacts?: ReadonlyArray<{ readonly email?: string | null } | null> | null;
    } | null;
  } | null;
  readonly tags?: ReadonlyArray<TagNode | null | undefined> | null;
  readonly toolConnections?: ReadonlyArray<ToolConnectionNode | null | undefined> | null;
}

/**
 * Maps GraphQL `Tag` nodes to `DeviceTag`, renaming `id` → `tagId`.
 *
 * Relay hands back readonly arrays, so `values` is copied rather than cast.
 */
export function toDeviceTags(tags: ReadonlyArray<TagNode | null | undefined> | null | undefined): DeviceTag[] {
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

function toToolConnections(
  connections: ReadonlyArray<ToolConnectionNode | null | undefined> | null | undefined,
): ToolConnection[] | undefined {
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
            lastSyncAt: tc.lastSyncAt ?? undefined,
            disconnectedAt: tc.disconnectedAt ?? undefined,
          },
        ]
      : [],
  );
}

/**
 * Adapts a `Machine` node to the flat `Device` the shared device tables, cards
 * and selectors render.
 *
 * The single list-row transform, used by both transports: the Relay device
 * queries and the react-query whole-fleet read. Only fields present in the
 * caller's selection are populated — this is a list row, not the full
 * multi-source record `createDevice()` assembles from GraphQL + Fleet +
 * MeshCentral for the detail page.
 */
export function machineToDevice(machine: MachineLike): Device {
  const ip = machine.ip ?? undefined;
  const hostname = machine.hostname ?? '';

  return {
    // Core Identifiers
    id: machine.id,
    machineId: machine.machineId ?? '',
    hostname,
    displayName: machine.displayName || hostname,

    // Hardware - Identifiers
    hardware_serial: machine.serialNumber ?? undefined,
    hardware_vendor: machine.manufacturer ?? undefined,
    hardware_model: machine.model ?? undefined,
    serial_number: machine.serialNumber ?? undefined,
    serialNumber: machine.serialNumber ?? undefined,
    manufacturer: machine.manufacturer ?? undefined,
    model: machine.model ?? undefined,

    // Network
    primary_ip: ip,
    primary_mac: machine.macAddress ?? undefined,
    local_ips: ip ? [ip] : [],
    ip,
    macAddress: machine.macAddress ?? undefined,

    // System Status
    status: machine.status ?? '',
    last_seen: machine.lastSeen ?? undefined,
    lastSeen: machine.lastSeen ?? undefined,
    last_enrolled_at: machine.registeredAt ?? undefined,

    // Operating System
    platform: machine.osType ?? undefined,
    os_version: machine.osVersion ?? undefined,
    build: machine.osBuild ?? undefined,
    operating_system: machine.osType ?? undefined,
    osType: machine.osType ?? undefined,
    osVersion: machine.osVersion ?? undefined,
    osBuild: machine.osBuild ?? undefined,

    // Software & Versions
    agentVersion: machine.agentVersion ?? undefined,

    // Organization
    organizationId: machine.organization?.organizationId ?? undefined,
    organization: machine.organization?.name ?? undefined,
    // A customer can carry several contacts; the column shows one, so take the
    // first that actually has an address.
    organizationEmail: machine.organization?.contactInformation?.contacts?.find(c => c?.email)?.email ?? undefined,
    organizationImageUrl: machine.organization?.image?.imageUrl ?? null,
    organizationImageHash: machine.organization?.image?.hash ?? null,

    tags: toDeviceTags(machine.tags),
    toolConnections: toToolConnections(machine.toolConnections),

    // Misc
    type: machine.type ?? undefined,
    registeredAt: machine.registeredAt ?? undefined,
    updatedAt: machine.updatedAt ?? undefined,
    osUuid: machine.osUuid ?? undefined,
    timezone: machine.timezone ?? undefined,
  };
}
