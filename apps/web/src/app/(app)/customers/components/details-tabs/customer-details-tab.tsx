'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { LoadingWhen, StackedRowsPanel, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { LoadingParagraph } from '@/app/components/shared/loading-paragraph';
import { ValueText } from '@/app/components/shared/value-text';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { buildCustomerContactRows, buildCustomerInfoRows, buildNoContactsRow } from './customer-details-rows';

/** A cell value: the text with the truncation tooltip, or the muted empty mark; in a loading scope, its own bar. */
const cell = (value: string | null | undefined, skeletonWidth?: string) => (
  <ValueText value={value} skeletonWidth={skeletonWidth} />
);

/** The notes card's frame. */
const NOTES_CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] pb-[var(--spacing-system-s)] pt-[var(--spacing-system-l)]';

/** Contacts drawn while the customer loads (typical: one contact; a customer with more moves the content below it). */
const CONTACTS_SKELETON_ROWS = 1;

/** Lines of the notes text drawn while the customer loads (a typical note). */
const NOTES_SKELETON_LINES = 2;

function CustomerNotesCard({ notes, loading }: { notes: string; loading: boolean }) {
  const hasNotes = notes.trim() !== '';
  return (
    <section className={NOTES_CARD_CLASS}>
      <h2 className="text-ods-text-primary text-h2">Notes</h2>
      <LoadingParagraph
        loading={loading}
        text={hasNotes ? notes : 'No notes yet — add them from Edit Customer.'}
        tone={hasNotes ? 'primary' : 'secondary'}
        className={hasNotes ? 'whitespace-pre-wrap break-words' : undefined}
        lines={NOTES_SKELETON_LINES}
      />
    </section>
  );
}

interface CustomerDetailsTabProps {
  /** `null` while the customer loads: the tab draws its values as bars. */
  organization: CustomerDetails | null;
}

/**
 * The Details tab: the info card (Website; the two addresses), the contacts card and the Notes card. While the
 * customer loads the same panels draw (from the same row definitions, `customer-details-rows`) with every value a
 * `text-h4` bar, one contact (a customer with more moves the content below it, by design), and two lines of notes.
 */
export function CustomerDetailsTab({ organization }: CustomerDetailsTabProps) {
  const scoped = useLoadingScope();
  const customer = scoped ? null : organization;

  const website = customer?.website ?? '';
  const websiteHref = website ? (website.startsWith('http') ? website : `https://${website}`) : undefined;

  const infoRows = buildCustomerInfoRows({
    website: cell(customer?.website, 'w-40'),
    websiteHref,
    websiteIcon: <ExternalLinkIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />,
    physicalAddress: cell(customer?.physicalAddress, 'w-72'),
    mailingAddress: cell(customer?.mailingAddress, 'w-72'),
  });

  // While the customer loads, a typical customer's contacts, each cell drawing its own bar in the scope.
  const contacts = customer?.contacts ?? Array.from({ length: CONTACTS_SKELETON_ROWS }, () => null);
  return (
    <LoadingWhen loading={!customer}>
      <div className="flex flex-col gap-[var(--spacing-system-l)]">
        <StackedRowsPanel rows={infoRows} />
        <StackedRowsPanel
          listItems={contacts.length > 0}
          rows={
            contacts.length > 0
              ? buildCustomerContactRows(
                  contacts.map(contact => ({
                    contactName: cell(contact?.contactName, 'w-28'),
                    title: cell(contact?.title, 'w-28'),
                    email: cell(contact?.email, 'w-40'),
                    phone: cell(contact?.phone, 'w-28'),
                  })),
                )
              : [buildNoContactsRow()]
          }
        />
        <CustomerNotesCard notes={customer?.notes.join('\n') ?? ''} loading={!customer} />
      </div>
    </LoadingWhen>
  );
}
