'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { StackedRowsPanel } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ValueText } from '@/app/components/shared/value-text';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { buildCustomerContactRows, buildCustomerInfoRows, buildNoContactsRow } from './customer-details-rows';

/** A cell value: the text with the truncation tooltip, or the muted empty mark. */
const cell = (value?: string | null) => <ValueText value={value} />;

function CustomerNotesCard({ notes }: { notes: string }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] pb-[var(--spacing-system-s)] pt-[var(--spacing-system-l)]">
      <h2 className="text-ods-text-primary text-h2">Notes</h2>
      {notes.trim() ? (
        <p className="whitespace-pre-wrap break-words text-ods-text-primary text-h4">{notes}</p>
      ) : (
        <p className="text-ods-text-secondary text-h4">No notes yet — add them from Edit Customer.</p>
      )}
    </section>
  );
}

interface CustomerDetailsTabProps {
  organization: CustomerDetails;
}

export function CustomerDetailsTab({ organization }: CustomerDetailsTabProps) {
  const hasWebsite = Boolean(organization.website);
  const websiteHref = hasWebsite
    ? organization.website.startsWith('http')
      ? organization.website
      : `https://${organization.website}`
    : undefined;

  const infoRows = buildCustomerInfoRows({
    website: cell(organization.website),
    websiteHref,
    websiteIcon: <ExternalLinkIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />,
    physicalAddress: cell(organization.physicalAddress),
    mailingAddress: cell(organization.mailingAddress),
  });

  const contactRows =
    organization.contacts.length > 0
      ? buildCustomerContactRows(
          organization.contacts.map(contact => ({
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
      <StackedRowsPanel rows={contactRows} />
      <CustomerNotesCard notes={organization.notes.join('\n')} />
    </div>
  );
}
