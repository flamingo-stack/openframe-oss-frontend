'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { rawIdOfType } from '@/lib/relay-id';
import { routes } from '@/lib/routes';
import { TicketDetailsView } from '../components/ticket-details-view';

export default function TicketDetailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id') ?? undefined;
  // A link from a bundle older than the raw-id mapping, or an `@ticket:` mention one of
  // them wrote into a chat, carries the Relay global `Ticket.id`. The page keys its
  // queries on the id it is given and notifications route by the raw one, so the view
  // only ever sees the raw id.
  const ticketId = id && rawIdOfType('Ticket', id);

  useEffect(() => {
    if (!id) {
      router.replace(routes.tickets.list);
    } else if (ticketId && ticketId !== id) {
      // The live query, not `searchParams`: the Mingo drawer writes `?mingoDialog=`
      // with `history.replaceState`, which `useSearchParams` reads a transition late.
      const params = new URLSearchParams(window.location.search);
      params.set('id', ticketId);
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }
  }, [id, ticketId, router]);

  if (!ticketId) return null;

  return <TicketDetailsView ticketId={ticketId} />;
}
