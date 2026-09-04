'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { fleetApiClient } from '@/lib/fleet-api-client';
import {
  getMeshCentralDeviceInfo,
  parseMeshCentralDeviceStatus,
  parseMeshCentralLastSeen,
} from '@/lib/meshcentral/meshcentral-api';
import { fetchDeviceNode } from '../queries/devices-api';
import type {
  Battery,
  Device,
  DeviceDataSources,
  DeviceGraphQlNode,
  DevicePolicy,
  Software,
  User,
} from '../types/device.types';
import type { FleetHost } from '../types/fleet.types';
import { toDeviceTags } from '../utils/device-transform';
import { deviceQueryKeys } from '../utils/query-keys';
import { getToolConnectionState, isDeviceStillConnecting } from '../utils/tool-connection-status';

/** Collect unique end-user emails from Fleet `end_users` (primary email + other_emails). */
function collectEndUserEmails(fleetData: FleetHost | null): string[] | undefined {
  if (!fleetData?.end_users?.length) return undefined;
  const emails = new Set<string>();
  for (const user of fleetData.end_users) {
    if (user.email) emails.add(user.email);
    for (const other of user.other_emails || []) {
      if (other.email) emails.add(other.email);
    }
  }
  return emails.size > 0 ? Array.from(emails) : undefined;
}

/**
 * Create Device object directly from API responses
 * No normalization layer - direct mapping
 */
function createDevice(
  node: DeviceGraphQlNode,
  fleetData: FleetHost | null,
  meshCentralStatus: 'online' | 'offline' | null,
  meshCentralLastSeen: string | null,
  sources: DeviceDataSources,
): Device {
  // Transform Fleet software to unified Software type
  const software: Software[] =
    fleetData?.software?.map(fs => {
      const signatureTeamId = fs.signature_information?.find(s => s.team_identifier)?.team_identifier;
      return {
        id: fs.id,
        name: fs.name,
        version: fs.version,
        source: fs.source,
        vendor: fs.vendor || undefined, // Normalize null to undefined
        bundle_identifier: fs.bundle_identifier,
        vulnerabilities: (fs.vulnerabilities || []).map(v => ({
          cve: v.cve,
          details_link: v.details_link,
          created_at: v.created_at,
          // Fleet Premium severity fields — pass through when present.
          cvss_score: v.cvss_score ?? undefined,
          epss_probability: v.epss_probability ?? undefined,
          cisa_known_exploit: v.cisa_known_exploit ?? undefined,
          cve_published: v.cve_published ?? undefined,
          resolved_in_version: v.resolved_in_version ?? undefined,
        })),
        installed_paths: fs.installed_paths,
        last_opened_at: fs.last_opened_at,
        signed: Boolean(signatureTeamId),
        signature_team_id: signatureTeamId,
        generated_cpe: fs.generated_cpe,
        browser: fs.browser,
        extension_id: fs.extension_id,
      };
    }) || [];

  // Transform Fleet batteries to unified Battery type
  const batteries: Battery[] =
    fleetData?.batteries?.map(fb => ({
      cycle_count: fb.cycle_count,
      health: fb.health,
    })) || [];

  // Transform Fleet per-host policies to unified DevicePolicy type
  const policies: DevicePolicy[] =
    fleetData?.policies?.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      critical: Boolean(p.critical),
      platform: p.platform,
      response: p.response ?? '',
    })) || [];

  // Transform Fleet users to unified User type
  const users: User[] =
    fleetData?.users?.map(fu => ({
      username: fu.username,
      uid: fu.uid,
      type: fu.type,
      groupname: fu.groupname,
      shell: fu.shell,
      isLoggedIn: fu.type === 'person',
    })) || [];

  // Helper to check if IP is private
  const isPrivateIp = (ip: string): boolean => {
    if (!ip) return false;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('172.')) {
      const second = parseInt(ip.split('.')[1]);
      if (second >= 16 && second <= 31) return true;
    }
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('127.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('fe80:')) return true;
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:')) return true;
    if (ip === '::1') return true;
    return false;
  };

  // Determine actual public IP (filter private IPs)
  let actualPublicIp = '';
  if (fleetData?.public_ip && !isPrivateIp(fleetData.public_ip)) {
    actualPublicIp = fleetData.public_ip;
  }

  // Merge ALL IPs from Fleet into unified array
  const localIps: string[] = [];
  const seenIps = new Set<string>();

  // Add Fleet primary_ip first (local IP)
  if (fleetData?.primary_ip && !seenIps.has(fleetData.primary_ip)) {
    localIps.push(fleetData.primary_ip);
    seenIps.add(fleetData.primary_ip);
  }

  // Add Fleet public_ip if actually public
  if (fleetData?.public_ip && !isPrivateIp(fleetData.public_ip) && !seenIps.has(fleetData.public_ip)) {
    localIps.push(fleetData.public_ip);
    seenIps.add(fleetData.public_ip);
  }

  // Add Node IP
  if (node.ip && !seenIps.has(node.ip)) {
    localIps.push(node.ip);
    seenIps.add(node.ip);
  }

  // Extract logged in user
  const loggedUser = users.find(u => u.isLoggedIn) || users[0];

  return {
    // Core Identifiers
    id: node.id,
    machineId: node.machineId,
    hostname: node.hostname,
    displayName: node.displayName || node.hostname,
    nickname: node.nickname ?? undefined,

    // Hardware - CPU
    cpu_brand: fleetData?.cpu_brand,
    cpu_type: fleetData?.cpu_type,
    cpu_subtype: fleetData?.cpu_subtype,
    cpu_physical_cores: fleetData?.cpu_physical_cores,
    cpu_logical_cores: fleetData?.cpu_logical_cores,

    // Hardware - Memory
    memory: fleetData?.memory,
    totalRam: fleetData?.memory ? `${(fleetData.memory / 1024 ** 3).toFixed(2)} GB` : undefined,

    // Hardware - Identifiers
    hardware_serial: fleetData?.hardware_serial,
    hardware_vendor: fleetData?.hardware_vendor,
    hardware_model: fleetData?.hardware_model,
    hardware_version: fleetData?.hardware_version,
    serial_number: fleetData?.hardware_serial || node.serialNumber,
    manufacturer: fleetData?.hardware_vendor || node.manufacturer,
    model: fleetData?.hardware_model || node.model,
    make_model: fleetData?.hardware_model || [node.manufacturer, node.model].filter(Boolean).join(' '),

    // Storage
    gigs_disk_space_available: fleetData?.gigs_disk_space_available,
    percent_disk_space_available: fleetData?.percent_disk_space_available,
    gigs_total_disk_space: fleetData?.gigs_total_disk_space,
    disk_encryption_enabled: fleetData?.disk_encryption_enabled,

    // Network
    primary_ip: fleetData?.primary_ip,
    primary_mac: fleetData?.primary_mac,
    public_ip: actualPublicIp,
    local_ips: localIps,
    ip: fleetData?.primary_ip || node.ip || localIps[0],
    macAddress: fleetData?.primary_mac || node.macAddress,

    // System Status
    status: node.status || fleetData?.status || 'UNKNOWN',
    uptime: fleetData?.uptime,
    last_seen: fleetData?.seen_time || node.lastSeen,
    lastSeen: fleetData?.seen_time || node.lastSeen,
    last_restarted_at: fleetData?.last_restarted_at,
    last_enrolled_at: fleetData?.last_enrolled_at,
    boot_time: fleetData?.last_restarted_at ? new Date(fleetData.last_restarted_at).getTime() / 1000 : 0,

    // Operating System
    platform: fleetData?.platform,
    platform_like: fleetData?.platform_like,
    os_version: fleetData?.os_version,
    build: fleetData?.build,
    code_name: fleetData?.code_name,
    operating_system: fleetData?.platform || node.osType,
    osType: fleetData?.platform || node.osType,
    osVersion: fleetData?.os_version || node.osVersion,
    osBuild: fleetData?.build || node.osBuild,

    // Software & Versions
    osquery_version: fleetData?.osquery_version,
    orbit_version: fleetData?.orbit_version,
    fleet_desktop_version: fleetData?.fleet_desktop_version,
    scripts_enabled: fleetData?.scripts_enabled,
    agentVersion: node.agentVersion,
    version: node.agentVersion,

    // Unified Arrays (NO NESTING)
    software,
    batteries,
    users,
    policies,

    // Organization
    organizationId: node.organization?.organizationId,
    organization: node.organization?.name,
    organizationImageUrl: node.organization?.image?.imageUrl || null,
    organizationImageHash: node.organization?.image?.hash || null,

    // Tags
    tags: toDeviceTags(node.tags),

    // Tool Connections (enriched with status + lastSeen from Fleet / MeshCentral API)
    toolConnections: (node.toolConnections || []).map(tc => {
      const base = { ...tc };
      if (tc.toolType === 'FLEET_MDM') {
        return {
          ...base,
          ...(fleetData?.status != null && { status: String(fleetData.status).toLowerCase() }),
          ...(fleetData?.seen_time != null && { lastSeen: fleetData.seen_time }),
          ...(fleetData?.detail_updated_at != null && { lastFetched: fleetData.detail_updated_at }),
        };
      }
      if (tc.toolType === 'MESHCENTRAL') {
        return {
          ...base,
          ...(meshCentralStatus != null && { status: meshCentralStatus }),
          ...(meshCentralLastSeen != null && { lastSeen: meshCentralLastSeen }),
        };
      }
      return base;
    }),
    installedAgents: node.installedAgents,

    // Misc
    type: node.type,
    registeredAt: fleetData?.last_enrolled_at || node.registeredAt,
    updatedAt: fleetData?.detail_updated_at || fleetData?.seen_time || node.updatedAt || node.lastSeen,
    osUuid: fleetData?.uuid || node.osUuid,
    timezone: node.timezone,

    // Fleet-derived metadata (already in the host payload)
    software_updated_at: fleetData?.software_updated_at,
    sources,
    fleetTeamName: fleetData?.team_name || undefined,
    fleetTeamId: fleetData?.team_id,
    // Drop Fleet's builtin auto-labels ("All Hosts", "macOS", …) — keep meaningful (regular) ones.
    fleetLabels: fleetData?.labels
      ?.filter(l => l.label_type !== 'builtin')
      .map(l => l.name)
      .filter(Boolean),
    failingPoliciesCount: fleetData?.issues?.failing_policies_count,
    totalIssuesCount: fleetData?.issues?.total_issues_count,
    geolocation: fleetData?.geolocation
      ? { city: fleetData.geolocation.city_name, country: fleetData.geolocation.country_iso }
      : undefined,
    endUserEmails: collectEndUserEmails(fleetData),

    // Reference IDs
    fleetId: fleetData?.id,
    agent_id: node.machineId || node.id,

    // Legacy fields
    serialNumber: fleetData?.hardware_serial || node.serialNumber,
    description: node.displayName || fleetData?.hostname || node.hostname,
    plat: fleetData?.platform || node.osType,
    logged_in_username: loggedUser?.username,
    logged_username: loggedUser?.username,
  };
}

async function fetchDeviceDetails(machineId: string): Promise<Device> {
  // 1) Fetch primary device from the shared device query layer
  const node = await fetchDeviceNode(machineId);

  // 2.5) Fetch Fleet MDM details — only for a live connection: a pending row has no
  // host to fetch yet, and a DISCONNECTED row may carry a stale host id.
  const fleet = node.toolConnections?.find(tc => tc.toolType === 'FLEET_MDM');
  const fleetState = getToolConnectionState(fleet);
  let fleetData: FleetHost | null = null;
  let fleetSource: DeviceDataSources['fleet'];
  if (fleetState === 'pending') {
    fleetSource = 'skipped-pending';
  } else if (fleetState === 'disconnected') {
    fleetSource = 'skipped-disconnected';
  } else {
    // Validate that agentToolId is a valid numeric string before calling Fleet API
    const fleetHostId = Number(fleet?.agentToolId);
    if (Number.isInteger(fleetHostId) && fleetHostId > 0) {
      const fResponse = await fleetApiClient.getHost(fleetHostId);
      if (fResponse.ok && fResponse.data?.host) {
        fleetData = fResponse.data.host;
        fleetSource = 'ok';
      } else {
        // ok-but-no-host (deleted from Fleet) and transport/HTTP failures alike:
        // without this the tabs would read "no data" as "genuinely empty".
        fleetSource = 'error';
      }
    } else {
      console.warn(`Invalid Fleet host ID format: "${fleet?.agentToolId}" - expected numeric ID`);
      fleetSource = 'error';
    }
  }

  // 2.6) Fetch MeshCentral deviceinfo (Agent status, Last agent connection) — same
  // live-only gate as Fleet. On error or parse failure: treat as offline, no
  // lastSeen — don't fail whole device load.
  const mesh = node.toolConnections?.find(tc => tc.toolType === 'MESHCENTRAL');
  let meshCentralStatus: 'online' | 'offline' | null = null;
  let meshCentralLastSeen: string | null = null;
  if (getToolConnectionState(mesh) === 'live') {
    try {
      const meshInfo = await getMeshCentralDeviceInfo(mesh?.agentToolId ?? '');
      meshCentralStatus = parseMeshCentralDeviceStatus(meshInfo);
      meshCentralLastSeen = parseMeshCentralLastSeen(meshInfo);
    } catch {
      // Don't set status — UI won't show status/lastSeen when we couldn't get data
    }
  }

  // 3) Create Device object directly - no normalization
  return createDevice(node, fleetData, meshCentralStatus, meshCentralLastSeen, { fleet: fleetSource });
}

interface UseDeviceDetailsOptions {
  polling?: boolean;
}

export function useDeviceDetails(machineId: string | null | undefined, options?: UseDeviceDetailsOptions) {
  const { toast } = useToast();
  const { polling = true } = options ?? {};
  const toastShownRef = useRef(false);

  const query = useQuery({
    queryKey: deviceQueryKeys.detail(machineId ?? ''),
    queryFn: machineId ? () => fetchDeviceDetails(machineId) : skipToken,
    staleTime: 3_000,
    retry: 1,
    retryDelay: 1_000,
    refetchInterval: polling
      ? liveQuery => {
          const data = liveQuery.state.data as Device | undefined;
          if (!data) return false;
          // Fast-poll while an agent registration is still pending so the pending →
          // connected transition lands quickly; settle to 10s once everything is live.
          return isDeviceStillConnecting(data) ? 5_000 : 10_000;
        }
      : false,
  });

  // Toast only on initial load failure (no cached data)
  useEffect(() => {
    if (query.error && !query.data && !toastShownRef.current) {
      toastShownRef.current = true;
      toast({
        title: 'Failed to Load Device Details',
        description: query.error instanceof Error ? query.error.message : 'Failed to fetch device details',
        variant: 'destructive',
      });
    }
    if (!query.error) {
      toastShownRef.current = false;
    }
  }, [query.error, query.data, toast]);

  return {
    deviceDetails: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    lastUpdated: query.dataUpdatedAt || null,
  };
}
