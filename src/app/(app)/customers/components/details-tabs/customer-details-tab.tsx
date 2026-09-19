'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { InfoCell } from '@/app/components/shared/info-cell';
import type { CustomerDetails } from '../../hooks/use-customer-details';

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

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <div className="flex flex-col rounded-md border border-ods-border bg-ods-card">
        <div className="flex h-20 items-center gap-[var(--spacing-system-m)] border-b border-ods-border px-[var(--spacing-system-m)]">
          <InfoCell
            value={organization.website}
            label="Website"
            icon={<ExternalLinkIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />}
            href={websiteHref}
          />
        </div>
        <div className="flex flex-col px-[var(--spacing-system-m)] py-[var(--spacing-system-m)] md:h-20 md:flex-row md:items-center md:gap-[var(--spacing-system-m)] md:py-0">
          <InfoCell value={organization.physicalAddress} label="Physical Address" />
          <InfoCell value={organization.mailingAddress} label="Mailing Address" />
        </div>
      </div>
      <CustomerNotesCard notes={organization.notes.join('\n')} />
    </div>
  );
}
