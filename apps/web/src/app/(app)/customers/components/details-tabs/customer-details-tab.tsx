'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { StackedRowsPanel, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ValueText } from '@/app/components/shared/value-text';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { buildCustomerContactRows, buildCustomerInfoRows, buildNoContactsRow } from './customer-details-rows';

/** A cell value: the text with the truncation tooltip, or the muted empty mark. */
const cell = (value?: string | null) => <ValueText value={value} />;

/** A cell value while the customer loads: a bar of the cell's own type step (`text-h4`). */
const bar = (width: string) => <TextLineSkeleton type="h4" as="span" className={width} />;

/** The notes card's frame. */
const NOTES_CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] pb-[var(--spacing-system-s)] pt-[var(--spacing-system-l)]';

/** Contacts drawn while the customer loads (typical: one contact; a customer with more moves the content below it). */
const CONTACTS_SKELETON_ROWS = 1;

/** One contact row while the customer loads: every value a `text-h4` bar. */
const SKELETON_CONTACT = { contactName: bar('w-28'), title: bar('w-28'), email: bar('w-40'), phone: bar('w-28') };

/** Lines of the notes text drawn while the customer loads (a typical note). */
const NOTES_SKELETON_LINES = 2;

function CustomerNotesCard({ notes, loading }: { notes: string; loading: boolean }) {
  return (
    <section className={NOTES_CARD_CLASS}>
      <h2 className="text-ods-text-primary text-h2">Notes</h2>
      {loading ? (
        <TextLineSkeleton type="h4" lines={NOTES_SKELETON_LINES} />
      ) : notes.trim() ? (
        <p className="whitespace-pre-wrap break-words text-ods-text-primary text-h4">{notes}</p>
      ) : (
        <p className="text-ods-text-secondary text-h4">No notes yet — add them from Edit Customer.</p>
      )}
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
    website: customer ? cell(customer.website) : bar('w-40'),
    websiteHref,
    websiteIcon: <ExternalLinkIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />,
    physicalAddress: customer ? cell(customer.physicalAddress) : bar('w-72'),
    mailingAddress: customer ? cell(customer.mailingAddress) : bar('w-72'),
  });

  const contactRows = !customer
    ? buildCustomerContactRows(Array.from({ length: CONTACTS_SKELETON_ROWS }, () => SKELETON_CONTACT))
    : customer.contacts.length > 0
      ? buildCustomerContactRows(
          customer.contacts.map(contact => ({
            contactName: cell(contact.contactName),
            title: cell(contact.title),
            email: cell(contact.email),
            phone: cell(contact.phone),
          })),
        )
      : [buildNoContactsRow()];

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <StackedRowsPanel rows={infoRows} />
      <StackedRowsPanel rows={contactRows} listItems={!customer || customer.contacts.length > 0} />
      <CustomerNotesCard notes={customer?.notes.join('\n') ?? ''} loading={!customer} />
    </div>
  );
}
