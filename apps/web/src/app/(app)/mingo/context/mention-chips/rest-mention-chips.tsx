'use client';
/**
 * Self-fetching mention chips for the REST / ai-agent-GraphQL entity types. One
 * generic component (`RestMentionChip`) backed by a per-marker async resolver,
 * driven by a TanStack `useSuspenseQuery` so the skeleton/Suspense story matches
 * the Relay chips. Resolvers never throw — they degrade to `{ label: id }` on a
 * failed response — so the chip always renders (id when the name can't load).
 *
 * id semantics + routes (per the picker in `rest-items.tsx` / `relay-items.tsx`):
 *   - policy → fleet `getPolicy(policyId)`        → /monitoring/policy/{id}
 *   - query  → fleet `getQuery(queryId)`          → /monitoring/query/{id}
 *   - script → tactical `getScript(id)`           → /scripts/details/{id}
 *   - ticket → ai-agent `ticket(id:)` GraphQL      → /tickets/dialog?id={id}
 *
 * The `script` resolver here is the LEGACY (Tactical) path. New scripts resolve
 * via the Relay `GraphqlMentionChip`; `render-mention.tsx` dispatches by id shape
 * (24-char ObjectId → new, numeric → this Tactical resolver) so BOTH resolve.
 */
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { formatTicketRef } from '@/app/(app)/tickets/utils/ticket-ref';
import { apiClient } from '@/lib/api-client';
import { fleetApiClient } from '@/lib/fleet-api-client';
import { routes } from '@/lib/routes';
import { MentionErrorBoundary, MentionTag } from './mention-tag';

interface Resolved {
  label: string;
  href?: string;
}

async function resolvePolicy(id: string): Promise<Resolved> {
  const res = await fleetApiClient.getPolicy(Number(id));
  return { label: (res.ok && res.data?.policy?.name) || id, href: routes.monitoring.policy(id) };
}

async function resolveQuery(id: string): Promise<Resolved> {
  const res = await fleetApiClient.getQuery(Number(id));
  // Fleet wraps the single-query response in `{ query: {...} }` (same as policies
  // under `policy`) — read the nested name, not a flat `res.data.name` (which is
  // always undefined → chip would show the bare id). See `use-query-details.ts`.
  const name = res.ok ? (res.data as unknown as { query?: { name?: string } }).query?.name : undefined;
  return { label: name || id, href: routes.monitoring.query(id) };
}

async function resolveScript(id: string): Promise<Resolved> {
  // TODO(openframe-rmm): Tactical RMM removed — the legacy single-script endpoint is gone.
  // Numeric (legacy) script ids can no longer resolve a name, so degrade to the id + link
  // (the caller's `fallbackLabel` is preferred over the raw id in `RestInner`). New scripts
  // resolve via the Relay `GraphqlMentionChip`. See render-mention.tsx dispatch.
  return { label: id, href: routes.scripts.details(id) };
}

interface TicketEnvelope {
  data?: { ticket?: { title?: string; ticketNumber?: number } };
}
async function resolveTicket(id: string): Promise<Resolved> {
  const res = await apiClient.post<TicketEnvelope>('/chat/graphql', {
    query: 'query MingoMentionTicket($id: ID!) { ticket(id: $id) { title ticketNumber } }',
    variables: { id },
  });
  const t = res.ok ? res.data?.data?.ticket : undefined;
  // `<number>: <title>` like the action modals; a miss degrades to the id so the
  // caller's `fallbackLabel` wins in `RestInner`.
  const label = formatTicketRef(t ?? {}, id);
  return { label, href: routes.tickets.dialog(encodeURIComponent(id)) };
}

const RESOLVERS: Record<string, (id: string) => Promise<Resolved>> = {
  policy: resolvePolicy,
  query: resolveQuery,
  script: resolveScript,
  ticket: resolveTicket,
};

interface RestMentionChipProps {
  marker: string;
  id: string;
  icon?: ReactNode;
  /** Known display name (e.g. a context item's picked label). Shown instead of
   *  the bare `id` when the live resolve can't find the entity. */
  fallbackLabel?: string;
}

/**
 * The chip's boundary: while its entity is fetched, the reader draws the chip itself (no label yet) in a loading
 * scope, where the `Tag` draws its own skeleton in the chip's box. Inline (a `span` with no box of its own: the chip
 * lives inside a `<p>`), and with no status of its own: a message can hold several chips loading at once, and a
 * "loading" read out mid-sentence for each would bury the message itself.
 */
function RestLoader(props: RestMentionChipProps) {
  return (
    <LoadingSuspense as="span" className="contents" status={false}>
      <RestReader {...props} />
    </LoadingSuspense>
  );
}

function RestReader(props: RestMentionChipProps) {
  // In a loading scope it draws the chip with no label and runs no read.
  if (useLoadingScope()) return <MentionTag icon={props.icon} label="" />;
  return <RestInner {...props} />;
}

function RestInner({ marker, id, icon, fallbackLabel }: RestMentionChipProps) {
  const { data } = useSuspenseQuery({
    queryKey: ['mingo-mention', marker, id],
    queryFn: () => RESOLVERS[marker](id),
    staleTime: 5 * 60 * 1000,
  });
  // Resolvers degrade to `{ label: id }` when the lookup misses; in that case
  // prefer the caller's known label over showing the raw id.
  const label = data.label === id && fallbackLabel ? fallbackLabel : data.label;
  return <MentionTag icon={icon} label={label} href={data.href} />;
}

export function RestMentionChip({ marker, id, icon, fallbackLabel }: RestMentionChipProps) {
  return (
    <MentionErrorBoundary fallback={<MentionTag icon={icon} label={fallbackLabel || id} />}>
      <RestLoader marker={marker} id={id} icon={icon} fallbackLabel={fallbackLabel} />
    </MentionErrorBoundary>
  );
}
