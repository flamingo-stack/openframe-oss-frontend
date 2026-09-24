'use client';

/**
 * Relay-backed context items for the GraphQL sources on OUR endpoint
 * (`/api/graphql`): Device, Organization, Knowledge Article, Script, Script
 * Schedule, Incident, Software, Vulnerability.
 *
 * Idiomatic Relay cursor pagination: a `@refetchable` fragment with
 * `@connection` + `useLazyLoadQuery` (suspends on initial load → the picker's
 * Suspense skeleton) + `usePaginationFragment` (`loadNext` on scroll). No manual
 * cursors / `hasMore` — Relay manages the connection in its store.
 */

import { ContextItemsList } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { useMemo } from 'react';
import { graphql, useLazyLoadQuery, usePaginationFragment } from 'react-relay';
import type { relayItemsDevices_query$key } from '@/__generated__/relayItemsDevices_query.graphql';
import type { relayItemsDevicesListQuery } from '@/__generated__/relayItemsDevicesListQuery.graphql';
import type { relayItemsDevicesPaginationQuery } from '@/__generated__/relayItemsDevicesPaginationQuery.graphql';
import type { relayItemsIncidents_query$key } from '@/__generated__/relayItemsIncidents_query.graphql';
import type { relayItemsIncidentsListQuery } from '@/__generated__/relayItemsIncidentsListQuery.graphql';
import type { relayItemsIncidentsPaginationQuery } from '@/__generated__/relayItemsIncidentsPaginationQuery.graphql';
import type { relayItemsKb_query$key } from '@/__generated__/relayItemsKb_query.graphql';
import type { relayItemsKbListQuery } from '@/__generated__/relayItemsKbListQuery.graphql';
import type { relayItemsKbPaginationQuery } from '@/__generated__/relayItemsKbPaginationQuery.graphql';
import type { relayItemsOrgs_query$key } from '@/__generated__/relayItemsOrgs_query.graphql';
import type { relayItemsOrgsListQuery } from '@/__generated__/relayItemsOrgsListQuery.graphql';
import type { relayItemsOrgsPaginationQuery } from '@/__generated__/relayItemsOrgsPaginationQuery.graphql';
import type { relayItemsSchedules_query$key } from '@/__generated__/relayItemsSchedules_query.graphql';
import type { relayItemsSchedulesListQuery } from '@/__generated__/relayItemsSchedulesListQuery.graphql';
import type { relayItemsSchedulesPaginationQuery } from '@/__generated__/relayItemsSchedulesPaginationQuery.graphql';
import type { relayItemsScripts_query$key } from '@/__generated__/relayItemsScripts_query.graphql';
import type { relayItemsScriptsListQuery } from '@/__generated__/relayItemsScriptsListQuery.graphql';
import type { relayItemsScriptsPaginationQuery } from '@/__generated__/relayItemsScriptsPaginationQuery.graphql';
import type { relayItemsSoftware_query$key } from '@/__generated__/relayItemsSoftware_query.graphql';
import type { relayItemsSoftwareListQuery } from '@/__generated__/relayItemsSoftwareListQuery.graphql';
import type { relayItemsSoftwarePaginationQuery } from '@/__generated__/relayItemsSoftwarePaginationQuery.graphql';
import type { relayItemsVulnerabilities_query$key } from '@/__generated__/relayItemsVulnerabilities_query.graphql';
import type { relayItemsVulnerabilitiesListQuery } from '@/__generated__/relayItemsVulnerabilitiesListQuery.graphql';
import type { relayItemsVulnerabilitiesPaginationQuery } from '@/__generated__/relayItemsVulnerabilitiesPaginationQuery.graphql';
import { DEFAULT_DEVICES_LIST_STATUSES } from '@/app/(app)/devices/constants/device-statuses';
import { getDeviceName } from '@/app/(app)/devices/utils/device-name';
import { INCIDENT_SEVERITY_LABELS, labelOf, WORKING_SET_STATUSES } from '@/app/(app)/incidents/utils/incident-labels';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { pluralize } from '@/lib/pluralize';
import { decodeGlobalId, rawIdOf } from '@/lib/relay-id';
import { CONTEXT_ENTITY_KIND } from './context-types';
import { type ContextItemsProps, MINGO_CONTEXT_PAGE_SIZE } from './items-shared';

// ───────────────────────────── Device ───────────────────────────────────────

// Mingo device context is restricted to live/relevant devices only: ONLINE
// (rendered as the green "active" state) and OFFLINE. Pending (still enrolling),
// archived, deleted, decommissioned, etc. are excluded so Mingo never lists or
// suggests actions on irrelevant devices.
//
// The filter is a VARIABLE, not an inline literal, so the status rule comes from
// `DEFAULT_DEVICES_LIST_STATUSES` — the same constant the Devices page and every
// react-query device read use — instead of drifting in this document.
const MINGO_DEVICE_FILTER = toRelayDeviceFilter({ statuses: [...DEFAULT_DEVICES_LIST_STATUSES] });

const DEVICES_FRAGMENT = graphql`
  fragment relayItemsDevices_query on Query
  @refetchable(queryName: "relayItemsDevicesPaginationQuery")
  @argumentDefinitions(
    filter: { type: "DeviceFilterInput" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    devices(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "relayItemsDevices_devices") {
      edges {
        node {
          id
          machineId
          hostname
          displayName
          nickname
          status
        }
      }
    }
  }
`;

const DEVICES_LIST_QUERY = graphql`
  query relayItemsDevicesListQuery($filter: DeviceFilterInput, $search: String, $first: Int) {
    ...relayItemsDevices_query @arguments(filter: $filter, search: $search, first: $first)
  }
`;

export function DeviceItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsDevicesListQuery>(DEVICES_LIST_QUERY, {
    filter: MINGO_DEVICE_FILTER,
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsDevicesPaginationQuery,
    relayItemsDevices_query$key
  >(DEVICES_FRAGMENT, root as relayItemsDevices_query$key);
  const items = useMemo(
    () =>
      (data.devices?.edges ?? []).flatMap(e =>
        e?.node
          ? [
              {
                type: CONTEXT_ENTITY_KIND.DEVICE,
                // Store the RAW db id, decoded from the Relay global `id`
                // (`base64("Machine:<rawId>")`) — that's what the backend's
                // DEVICE context resolver + `@device:<id>` mention marker expect.
                // The chip re-encodes it to a global id for its `node(id:)` fetch
                // (see relay-mention-chips). Falls back to `machineId` if decode
                // ever fails.
                id: decodeGlobalId(e.node.id)?.rawId ?? e.node.machineId,
                // `getDeviceName` (nickname → displayName → hostname) — the same
                // name the device page, the devices table and the mention chip
                // show, so the picked label can't disagree with the chip it
                // becomes.
                label: getDeviceName(e.node) || e.node.machineId,
                description: e.node.status ?? undefined,
              },
            ]
          : [],
      ),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No devices"
    />
  );
}

// ─────────────────────────── Organization ───────────────────────────────────

const ORGS_FRAGMENT = graphql`
  fragment relayItemsOrgs_query on Query
  @refetchable(queryName: "relayItemsOrgsPaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    organizations(search: $search, first: $first, after: $after) @connection(key: "relayItemsOrgs_organizations") {
      edges {
        node {
          id
          name
          category
        }
      }
    }
  }
`;

const ORGS_LIST_QUERY = graphql`
  query relayItemsOrgsListQuery($search: String, $first: Int) {
    ...relayItemsOrgs_query @arguments(search: $search, first: $first)
  }
`;

export function OrganizationItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsOrgsListQuery>(ORGS_LIST_QUERY, {
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsOrgsPaginationQuery,
    relayItemsOrgs_query$key
  >(ORGS_FRAGMENT, root as relayItemsOrgs_query$key);
  const items = useMemo(
    () =>
      (data.organizations?.edges ?? []).flatMap(e =>
        e?.node
          ? [
              {
                type: CONTEXT_ENTITY_KIND.ORGANIZATION,
                // Raw db id (organizationId), decoded from the global `id`
                // (`base64("Organization:<rawId>")`); the chip re-encodes it.
                id: rawIdOf(e.node.id),
                label: e.node.name || e.node.id,
                description: e.node.category ?? undefined,
              },
            ]
          : [],
      ),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No customers"
    />
  );
}

// ─────────────────────────── Knowledge Article ──────────────────────────────

const KB_FRAGMENT = graphql`
  fragment relayItemsKb_query on Query
  @refetchable(queryName: "relayItemsKbPaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    knowledgeBaseItems(filter: { type: ARTICLE }, search: $search, first: $first, after: $after)
      @connection(key: "relayItemsKb_knowledgeBaseItems") {
      edges {
        node {
          id
          name
          type
        }
      }
    }
  }
`;

const KB_LIST_QUERY = graphql`
  query relayItemsKbListQuery($search: String, $first: Int) {
    ...relayItemsKb_query @arguments(search: $search, first: $first)
  }
`;

export function KnowledgeBaseItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsKbListQuery>(KB_LIST_QUERY, {
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsKbPaginationQuery,
    relayItemsKb_query$key
  >(KB_FRAGMENT, root as relayItemsKb_query$key);
  const items = useMemo(
    () =>
      (data.knowledgeBaseItems?.edges ?? []).flatMap(e =>
        e?.node
          ? [
              {
                type: CONTEXT_ENTITY_KIND.KB_ARTICLE,
                // Raw db id, decoded from the global `id`
                // (`base64("KnowledgeBaseItem:<rawId>")`); the chip re-encodes it.
                id: rawIdOf(e.node.id),
                label: e.node.name || e.node.id,
                description: e.node.type ?? undefined,
              },
            ]
          : [],
      ),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No knowledge articles"
    />
  );
}

// ───────────────────────────── Script ───────────────────────────────────────

// Mingo script context lists ACTIVE scripts only — ARCHIVED / DELETED are
// excluded so Mingo never suggests running a retired script. Native OpenFrame
// GraphQL `scripts(...)` connection (the v2 source), with server-side search.
// `[ACTIVE]` is inlined because the Relay compiler needs a static document.
const SCRIPTS_FRAGMENT = graphql`
  fragment relayItemsScripts_query on Query
  @refetchable(queryName: "relayItemsScriptsPaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    scripts(filter: { statuses: [ACTIVE] }, search: $search, first: $first, after: $after)
      @connection(key: "relayItemsScripts_scripts") {
      edges {
        node {
          id
          name
          description
        }
      }
    }
  }
`;

const SCRIPTS_LIST_QUERY = graphql`
  query relayItemsScriptsListQuery($search: String, $first: Int) {
    ...relayItemsScripts_query @arguments(search: $search, first: $first)
  }
`;

export function ScriptItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsScriptsListQuery>(SCRIPTS_LIST_QUERY, {
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsScriptsPaginationQuery,
    relayItemsScripts_query$key
  >(SCRIPTS_FRAGMENT, root as relayItemsScripts_query$key);
  const items = useMemo(
    () =>
      (data.scripts?.edges ?? []).flatMap(e => {
        // Raw db id, decoded from the global `id` (`base64("Script:<rawId>")`);
        // that's what the backend's SCRIPT context resolver + `@script:<id>` marker
        // expect. The chip re-encodes it to a global id for its `script(id:)` fetch
        // (see relay-mention-chips). Drop any edge we can't decode to a raw id — a
        // global id stored here would misroute the chip to the legacy Tactical
        // resolver (its id-shape dispatch treats non-24-hex as a Tactical id).
        const rawId = e?.node ? decodeGlobalId(e.node.id)?.rawId : null;
        if (!e?.node || !rawId) return [];
        return [
          {
            type: CONTEXT_ENTITY_KIND.SCRIPT,
            id: rawId,
            label: e.node.name || rawId,
            description: e.node.description ?? undefined,
          },
        ];
      }),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No scripts"
    />
  );
}

// ────────────────────────── Script Schedule ─────────────────────────────────

// Mingo schedule context lists ACTIVE schedules only — an ARCHIVED schedule runs
// on nothing, so offering it as context would let Mingo reason about a job that
// can never fire. Same `[ACTIVE]` inlining reason as the scripts fragment above.
const SCHEDULES_FRAGMENT = graphql`
  fragment relayItemsSchedules_query on Query
  @refetchable(queryName: "relayItemsSchedulesPaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    scriptSchedules(filter: { statuses: [ACTIVE] }, search: $search, first: $first, after: $after)
      @connection(key: "relayItemsSchedules_scriptSchedules") {
      edges {
        node {
          id
          name
          description
        }
      }
    }
  }
`;

const SCHEDULES_LIST_QUERY = graphql`
  query relayItemsSchedulesListQuery($search: String, $first: Int) {
    ...relayItemsSchedules_query @arguments(search: $search, first: $first)
  }
`;

export function ScheduleItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsSchedulesListQuery>(SCHEDULES_LIST_QUERY, {
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsSchedulesPaginationQuery,
    relayItemsSchedules_query$key
  >(SCHEDULES_FRAGMENT, root as relayItemsSchedules_query$key);
  const items = useMemo(
    () =>
      (data.scriptSchedules?.edges ?? []).flatMap(e => {
        // Raw db id, decoded from the global `id` (`base64("ScriptSchedule:<rawId>")`)
        // — that's what the backend's SCHEDULED_SCRIPT resolver
        // (`ScriptScheduleService.findById`) + the `@scheduledScript:<id>` marker
        // expect. The chip re-encodes it to a global id for its `scriptSchedule(id:)`
        // fetch. Drop any edge we can't decode: a global id stored here would be
        // double-encoded on the way back and resolve to nothing.
        const rawId = e?.node ? decodeGlobalId(e.node.id)?.rawId : null;
        if (!e?.node || !rawId) return [];
        return [
          {
            type: CONTEXT_ENTITY_KIND.SCHEDULED_SCRIPT,
            id: rawId,
            label: e.node.name || rawId,
            description: e.node.description ?? undefined,
          },
        ];
      }),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No script schedules"
    />
  );
}

// ───────────────────────────── Incident ─────────────────────────────────────

// Mingo incident context lists the WORKING SET only — the same default the
// Incidents page opens on: everything but ARCHIVED, which is filed away and
// nothing to act on. `Insight.id` is already the opaque id the `insight(id:)`
// query and the `@insight:<id>` marker take, so no decode/re-encode here.
const INCIDENT_CONTEXT_FILTER = { statuses: [...WORKING_SET_STATUSES] };

const INCIDENTS_FRAGMENT = graphql`
  fragment relayItemsIncidents_query on Query
  @refetchable(queryName: "relayItemsIncidentsPaginationQuery")
  @argumentDefinitions(
    filter: { type: "InsightFilter" }
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    insights(filter: $filter, search: $search, first: $first, after: $after)
      @connection(key: "relayItemsIncidents_insights") {
      edges {
        node {
          id
          title
          severity
          machine {
            nickname
            hostname
            displayName
          }
        }
      }
    }
  }
`;

const INCIDENTS_LIST_QUERY = graphql`
  query relayItemsIncidentsListQuery($filter: InsightFilter, $search: String, $first: Int) {
    ...relayItemsIncidents_query @arguments(filter: $filter, search: $search, first: $first)
  }
`;

export function IncidentItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsIncidentsListQuery>(INCIDENTS_LIST_QUERY, {
    filter: INCIDENT_CONTEXT_FILTER,
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsIncidentsPaginationQuery,
    relayItemsIncidents_query$key
  >(INCIDENTS_FRAGMENT, root as relayItemsIncidents_query$key);
  const items = useMemo(
    () =>
      (data.insights?.edges ?? []).flatMap(e => {
        if (!e?.node) return [];
        const device = getDeviceName(e.node.machine);
        return [
          {
            type: CONTEXT_ENTITY_KIND.INSIGHT,
            id: rawIdOf(e.node.id),
            label: e.node.title,
            description: [labelOf(INCIDENT_SEVERITY_LABELS, e.node.severity), device].filter(Boolean).join(' · '),
          },
        ];
      }),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No incidents"
    />
  );
}

// ───────────────────────────── Software ─────────────────────────────────────

// The fleet inventory, one row per title, the same `softwares` connection the
// Software page lists — searched on the server. `Software.id` is the inventory's
// own id (NOT a Relay global id): `software(id:)` and the details route take it
// as is, so it is stored as is, with no decode.
const SOFTWARE_FRAGMENT = graphql`
  fragment relayItemsSoftware_query on Query
  @refetchable(queryName: "relayItemsSoftwarePaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    softwares(search: $search, first: $first, after: $after) @connection(key: "relayItemsSoftware_softwares") {
      edges {
        node {
          id
          name
          publisher
          currentVersion
        }
      }
    }
  }
`;

const SOFTWARE_LIST_QUERY = graphql`
  query relayItemsSoftwareListQuery($search: String, $first: Int) {
    ...relayItemsSoftware_query @arguments(search: $search, first: $first)
  }
`;

export function SoftwareItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsSoftwareListQuery>(SOFTWARE_LIST_QUERY, {
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsSoftwarePaginationQuery,
    relayItemsSoftware_query$key
  >(SOFTWARE_FRAGMENT, root as relayItemsSoftware_query$key);
  const items = useMemo(
    () =>
      (data.softwares?.edges ?? []).flatMap(e =>
        e?.node
          ? [
              {
                type: CONTEXT_ENTITY_KIND.SOFTWARE,
                id: e.node.id,
                label: e.node.name || e.node.id,
                // The publisher and the version in use, as the Software list
                // reads under a title.
                description: [e.node.publisher, e.node.currentVersion].filter(Boolean).join(' · ') || undefined,
              },
            ]
          : [],
      ),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No software"
    />
  );
}

// ─────────────────────────── Vulnerability ──────────────────────────────────

// Every CVE across the fleet, one row per CVE — the `vulnerabilities`
// connection the Vulnerabilities page lists. A CVE has no id but its `cveId`,
// which is also its name: `vulnerability(cveId:)` and the details route take
// it, and the mention carries it verbatim. No severity, as nowhere in the
// Software module: the scanner does not rate the CVEs it reports.
const VULNERABILITIES_FRAGMENT = graphql`
  fragment relayItemsVulnerabilities_query on Query
  @refetchable(queryName: "relayItemsVulnerabilitiesPaginationQuery")
  @argumentDefinitions(
    search: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
  ) {
    vulnerabilities(search: $search, first: $first, after: $after)
      @connection(key: "relayItemsVulnerabilities_vulnerabilities") {
      edges {
        node {
          cveId
          devicesCount
        }
      }
    }
  }
`;

const VULNERABILITIES_LIST_QUERY = graphql`
  query relayItemsVulnerabilitiesListQuery($search: String, $first: Int) {
    ...relayItemsVulnerabilities_query @arguments(search: $search, first: $first)
  }
`;

export function VulnerabilityItems({ query, selectedKeys, onToggle, atLimit }: ContextItemsProps) {
  const root = useLazyLoadQuery<relayItemsVulnerabilitiesListQuery>(VULNERABILITIES_LIST_QUERY, {
    search: query || null,
    first: MINGO_CONTEXT_PAGE_SIZE,
  });
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    relayItemsVulnerabilitiesPaginationQuery,
    relayItemsVulnerabilities_query$key
  >(VULNERABILITIES_FRAGMENT, root as relayItemsVulnerabilities_query$key);
  const items = useMemo(
    () =>
      (data.vulnerabilities?.edges ?? []).flatMap(e =>
        e?.node
          ? [
              {
                type: CONTEXT_ENTITY_KIND.VULNERABILITY,
                id: e.node.cveId,
                label: e.node.cveId,
                // How far the CVE reaches — the one figure the list shows per row.
                description: e.node.devicesCount != null ? pluralize(e.node.devicesCount, 'device') : undefined,
              },
            ]
          : [],
      ),
    [data],
  );
  return (
    <ContextItemsList
      items={items}
      selectedKeys={selectedKeys}
      onToggle={onToggle}
      atLimit={atLimit}
      hasMore={hasNext}
      onLoadMore={() => loadNext(MINGO_CONTEXT_PAGE_SIZE)}
      loadingMore={isLoadingNext}
      emptyLabel="No vulnerabilities"
    />
  );
}
