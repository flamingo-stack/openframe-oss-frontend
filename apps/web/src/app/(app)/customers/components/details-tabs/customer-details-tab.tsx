'use client';

import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { StackedRowsPanel, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { ValueText } from '@/app/components/shared/value-text';
import type { CustomerDetails } from '../../hooks/use-customer-details';
import { buildCustomerContactRows, buildCustomerInfoRows, buildNoContactsRow } from './customer-details-rows';

/** A cell value: the text with the truncation tooltip, or the muted empty mark. */
const cell = (value?: string | null) => <ValueText value={value} />;

/** The notes card's frame, shared by the card and its skeleton. */
const NOTES_CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] pb-[var(--spacing-system-s)] pt-[var(--spacing-system-l)]';

function CustomerNotesCard({ notes }: { notes: string }) {
  return (
    <section className={NOTES_CARD_CLASS}>
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
  /** `null` while the customer loads: the tab draws its own skeleton. */
  organization: CustomerDetails | null;
}

export function CustomerDetailsTab({ organization }: CustomerDetailsTabProps) {
  const loading = useLoadingScope() || !organization;
  if (loading) return <CustomerDetailsTabSkeleton />;

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

/**
 * The Details tab while the customer loads: the same panels, built from the same row definitions
 * (`customer-details-rows`) with skeleton values. The info card (Website; the two addresses), a contacts card with
 * one contact (a customer with more moves the content below it, by design), then the Notes card with its title
 * drawn for real and two lines of text.
 */
function CustomerDetailsTabSkeleton() {
  const infoRows = buildCustomerInfoRows({
    website: <UnifiedSkeleton as="span" className="h-5 w-40" />,
    websiteIcon: <UnifiedSkeleton className="size-6 shrink-0" />,
    physicalAddress: <UnifiedSkeleton as="span" className="h-5 w-72" />,
    mailingAddress: <UnifiedSkeleton as="span" className="h-5 w-72" />,
  });
  const contactRows = buildCustomerContactRows([
    {
      contactName: <UnifiedSkeleton as="span" className="h-5 w-28" />,
      title: <UnifiedSkeleton as="span" className="h-5 w-28" />,
      email: <UnifiedSkeleton as="span" className="h-5 w-40" />,
      phone: <UnifiedSkeleton as="span" className="h-5 w-28" />,
    },
  ]);

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <StackedRowsPanel rows={infoRows} />
      <StackedRowsPanel rows={contactRows} />
      <section className={NOTES_CARD_CLASS}>
        <h2 className="text-ods-text-primary text-h2">Notes</h2>
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <UnifiedSkeleton className="h-5 w-full content-md:h-6" />
          <UnifiedSkeleton className="h-5 w-2/3 content-md:h-6" />
        </div>
      </section>
    </div>
  );
}
