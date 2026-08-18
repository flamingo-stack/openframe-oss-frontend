'use client';

import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { type Customer, mapOrganizationNode, type OrganizationNode } from '@/app/(app)/customers/hooks/use-customers';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { type DeviceRowFields, rowFieldsToDevice } from '@/app/(app)/devices/utils/device-transform';
import type { KnowledgeBaseRow } from '@/app/(app)/knowledge-base/components/knowledge-base-table-columns';
import type { Dialog, DialogStatus } from '@/app/(app)/tickets/types/dialog.types';
import { postGraphQl } from './graphql';
import { ensureGlobalId } from './relay-id';
import {
  ASSIGNMENT_TARGET_TYPES,
  type AssignmentItemType,
  type AssignmentRef,
  type AssignmentsValue,
  type AssignmentTargetType,
} from './types';

const ASSIGNED_ITEMS_QUERY = `#graphql
  query AssignmentsAssignedItems($itemId: ID!, $targetType: AssignmentTargetType!, $first: Int) {
    assignedItems(itemId: $itemId, targetType: $targetType, first: $first) {
      edges {
        node {
          id
          displayName
          target {
            __typename
            id
            ... on Organization {
              organizationId
              name
              websiteUrl
              category
              numberOfEmployees
              monthlyRevenue
              contractEndDate
              createdAt
              updatedAt
              contactInformation { contacts { contactName email } }
              image { imageUrl hash }
            }
            # The row fields of deviceRowFields_machine — this list renders
            # DevicesTableBody, which draws no more than that. status, type and
            # tags are aliased because the union's other members declare the
            # same names with different types.
            ... on Machine {
              machineId
              hostname
              displayName
              machineStatus: status
              lastSeen
              machineType: type
              osType
              organization { id organizationId name image { imageUrl hash } }
              machineTags: tags { id key description color values createdAt }
            }
            ... on KnowledgeBaseItem {
              articleType: type
              name
              parentId
              articleStatus: status
              summary
              createdAt
              updatedAt
              articleTags: tags { id key color }
            }
            ... on Ticket {
              ticketNumber
              title
              description
              status
              creationSource
              deviceId
              deviceHostname
              ticketOrganizationId: organizationId
              organizationName
              assignedTo
              assignedName
              createdAt
              updatedAt
              resolvedAt
            }
          }
        }
      }
    }
  }
`;

const PAGE_SIZE = 100;

interface AssignedTargetNode {
  // biome-ignore lint/style/useNamingConvention: __typename is a GraphQL protocol field name
  __typename: 'Organization' | 'Machine' | 'Ticket' | 'KnowledgeBaseItem';
  id: string;
}

interface AssignedItemsData {
  assignedItems: {
    edges: Array<{
      node: { id: string; displayName: string; target: AssignedTargetNode | null };
    }>;
  };
}

function unaliasFields(target: AssignedTargetNode): Record<string, unknown> {
  const t = target as unknown as Record<string, unknown>;
  return {
    ...t,
    status: t.machineStatus ?? t.articleStatus ?? t.status,
    type: t.machineType ?? t.articleType ?? t.type,
    tags: t.machineTags ?? t.articleTags ?? t.tags,
    organizationId: t.ticketOrganizationId ?? t.organizationId,
  };
}

/**
 * The machine half of a target, in the shape the device transforms read.
 *
 * This query is raw POST over a union, so it has no Relay fragment reference to
 * hand `machineRowToDevice` and aliases the fields that collide across the
 * union's members. Building `DeviceRowFields` by hand is what bridges that — and
 * because that type is generated from `deviceRowFields_machine`, dropping a
 * field from this list is a compile error rather than an empty column.
 */
function toMachineRowFields(target: AssignedTargetNode): DeviceRowFields {
  const t = unaliasFields(target);
  return {
    id: target.id,
    machineId: t.machineId as string,
    hostname: t.hostname as string | null,
    displayName: t.displayName as string | null,
    osType: t.osType as DeviceRowFields['osType'],
    status: t.status as DeviceRowFields['status'],
    lastSeen: t.lastSeen ?? null,
    type: t.type as DeviceRowFields['type'],
    organization: t.organization as DeviceRowFields['organization'],
    tags: t.tags as DeviceRowFields['tags'],
  };
}

function toDialog(target: AssignedTargetNode): Dialog {
  const t = unaliasFields(target);
  return {
    id: target.id,
    title: (t.title as string) || 'Untitled Dialog',
    status: ((t.status as string) ?? 'ACTIVE') as DialogStatus,
    owner: { type: 'CLIENT' },
    createdAt: (t.createdAt as string) || '',
    resolvedAt: (t.resolvedAt as string) ?? null,
    ticketNumber: t.ticketNumber as number | undefined,
    description: t.description as string | undefined,
    creationSource: t.creationSource as string | undefined,
    deviceId: t.deviceId as string | undefined,
    deviceHostname: t.deviceHostname as string | undefined,
    organizationId: t.organizationId as string | undefined,
    organizationName: t.organizationName as string | undefined,
    assignedTo: t.assignedTo as string | undefined,
    assignedName: t.assignedName as string | undefined,
  };
}

interface AssignedItemsPayload {
  refs: AssignmentRef[];
  customers?: Customer[];
  devices?: Device[];
  articles?: KnowledgeBaseRow[];
  tickets?: Dialog[];
}

async function fetchAssignedItems(itemId: string, targetType: AssignmentTargetType): Promise<AssignedItemsPayload> {
  const data = await postGraphQl<AssignedItemsData>(ASSIGNED_ITEMS_QUERY, {
    itemId,
    targetType,
    first: PAGE_SIZE,
  });

  const refs: AssignmentRef[] = [];
  const customers: Customer[] = [];
  const devices: Device[] = [];
  const articles: KnowledgeBaseRow[] = [];
  const tickets: Dialog[] = [];

  for (const { node } of data.assignedItems.edges) {
    const target = node.target;
    if (!target) continue;
    refs.push({ id: target.id, label: node.displayName });
    switch (target.__typename) {
      case 'Organization':
        customers.push(mapOrganizationNode(unaliasFields(target) as unknown as OrganizationNode));
        break;
      case 'Machine':
        devices.push(rowFieldsToDevice(toMachineRowFields(target)));
        break;
      case 'KnowledgeBaseItem':
        articles.push(unaliasFields(target) as unknown as KnowledgeBaseRow);
        break;
      case 'Ticket':
        tickets.push(toDialog(target));
        break;
    }
  }

  switch (targetType) {
    case 'ORGANIZATION':
      return { refs, customers };
    case 'DEVICE':
      return { refs, devices };
    case 'KNOWLEDGE_ARTICLE':
      return { refs, articles };
    case 'TICKET':
      return { refs, tickets };
  }
}

interface UseAssignedItemsOptions {
  itemId: string | null;
  itemType: AssignmentItemType;
  enabled?: boolean;
}

export interface AssignedItemsResult {
  value: AssignmentsValue;
  customers?: Customer[];
  devices?: Device[];
  articles?: KnowledgeBaseRow[];
  tickets?: Dialog[];
  isLoading: boolean;
  isReady: boolean;
}

function combineAssignedItems(results: UseQueryResult<AssignedItemsPayload, Error>[]): AssignedItemsResult {
  const value: AssignmentsValue = {};
  const out: AssignedItemsResult = { value, isLoading: false, isReady: true };
  ASSIGNMENT_TARGET_TYPES.forEach((type, i) => {
    const result = results[i];
    if (result.isLoading) {
      out.isLoading = true;
      out.isReady = false;
    }
    // `isLoading` alone is not enough for `isReady`, which callers treat as "the
    // answer is in" and use to prefill forms. A PAUSED query (offline) reports
    // `isLoading: false` with no data, so `isReady` went true with an EMPTY
    // assignment set — and `use-edit-article-form.ts` then reset the form to
    // `assignments: []`, making Save delete every assignment on the article.
    // `fetchStatus === 'idle'` keeps a deliberately disabled query (create mode)
    // ready, since it has nothing to wait for.
    // `isError` as well as pending: a FAILED assignments fetch also leaves `value`
    // empty with `isPending` false, and `use-edit-article-form.ts` would reset the
    // form to `assignments: []` and let Save delete them. Guarding only the paused
    // half closed only the offline half of the data loss.
    if ((result.isPending && result.fetchStatus !== 'idle') || result.isError) {
      out.isReady = false;
    }
    const payload = result.data;
    if (!payload) return;
    if (payload.refs.length) value[type] = payload.refs;
    if (payload.customers?.length) out.customers = payload.customers;
    if (payload.devices?.length) out.devices = payload.devices;
    if (payload.articles?.length) out.articles = payload.articles;
    if (payload.tickets?.length) out.tickets = payload.tickets;
  });
  return out;
}

export function useAssignedItems({ itemId, itemType, enabled = true }: UseAssignedItemsOptions): AssignedItemsResult {
  const isEnabled = enabled && !!itemId;
  // TODO(backend): drop ensureGlobalId once ai-agent's Ticket type is Relay-compliant — see relay-id.ts.
  const normalizedItemId = itemId ? ensureGlobalId(itemType, itemId) : null;

  return useQueries({
    queries: ASSIGNMENT_TARGET_TYPES.map(targetType => ({
      queryKey: ['assignments', 'assigned-items', itemType, normalizedItemId, targetType],
      queryFn: () => fetchAssignedItems(normalizedItemId as string, targetType),
      enabled: isEnabled,
      staleTime: 30_000,
    })),
    combine: combineAssignedItems,
  });
}
