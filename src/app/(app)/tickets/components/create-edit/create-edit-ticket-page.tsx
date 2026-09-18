'use client';

import { PageLayout } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes, TICKET_PREFILL_KEYS, type TicketPrefill } from '@/lib/routes';
import { useCreateTicketForm } from '../../hooks/use-create-ticket-form';
import { TicketFormFields } from './ticket-form-fields';

export function CreateEditTicketPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('edit');

  // Create-mode starting values (see `routes.tickets.new`). Read once: the form
  // seeds its defaults from this on mount and owns the values from then on.
  const prefill = useMemo<TicketPrefill | undefined>(() => {
    if (ticketId) return undefined;
    const values: TicketPrefill = {};
    for (const key of TICKET_PREFILL_KEYS) values[key] = searchParams.get(key) ?? undefined;
    return Object.values(values).some(Boolean) ? values : undefined;
  }, [ticketId, searchParams]);

  const { form, ticket, isEditMode, ticketLoaded, isSubmitting, handleSave, tempAttachments, isFaeForm } =
    useCreateTicketForm({
      ticketId,
      prefill,
    });

  const backToTicket = useSafeBack(routes.tickets.dialog(ticketId ?? ''));
  const backToTickets = useSafeBack(routes.tickets.list);
  const backButton = useMemo(
    () =>
      isEditMode && ticketId ? { label: 'Back', onClick: backToTicket } : { label: 'Back', onClick: backToTickets },
    [isEditMode, ticketId, backToTicket, backToTickets],
  );

  const actions = useMemo(
    () => [
      {
        label: 'Cancel',
        onClick: backButton.onClick,
        variant: 'outline' as const,
        disabled: isSubmitting,
        // Desktop keeps the header "Back" link for cancelling; the explicit
        // Cancel button is only needed in the mobile/tablet bottom action bar.
        showOnlyMobile: true,
      },
      {
        label: isEditMode ? 'Save Changes' : 'Save Ticket',
        onClick: handleSave,
        variant: 'accent' as const,
        // `ticketLoaded`, not `isLoadingTicket`: a paused query reports not-loading
        // with no data, which would let Save write a blank form over the ticket.
        disabled: isSubmitting || (isEditMode && !ticketLoaded),
        loading: isSubmitting,
      },
    ],
    [backButton, handleSave, isSubmitting, ticketLoaded, isEditMode],
  );

  return (
    <PageLayout
      title={isEditMode ? 'Edit Ticket' : 'New Ticket'}
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      backButton={backButton}
      actions={actions}
      actionsVariant="primary-buttons"
    >
      <TicketFormFields
        form={form}
        ticket={ticket}
        prefill={prefill}
        tempAttachments={tempAttachments}
        isFaeForm={isFaeForm}
        isEditMode={isEditMode}
      />
    </PageLayout>
  );
}
