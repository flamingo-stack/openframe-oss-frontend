'use client';

import { AssignedItemsView, useAssignedItems } from '@/components/assignments';

/**
 * "Assigned Ticket": the tickets filed from this incident. The server records
 * the link as an assignment owned by the insight (item INSIGHT → target TICKET)
 * when a ticket is created with `insightId`, so this is the ticket page's
 * Assigned Items view pointed at the incident. Nothing while loading or empty —
 * a section that appears with its rows, not a slot the page reserves.
 */
export function IncidentAssignedTickets({ incidentId }: { incidentId: string }) {
  const { tickets } = useAssignedItems({ itemId: incidentId, itemType: 'INSIGHT' });
  if (!tickets?.length) return null;
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <h2 className="text-ods-text-primary text-h2">Assigned Ticket</h2>
      <AssignedItemsView itemId={incidentId} itemType="INSIGHT" showTitle={false} />
    </section>
  );
}
