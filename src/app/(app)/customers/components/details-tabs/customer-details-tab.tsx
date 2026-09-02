'use client';

import { ExternalLinkIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import type { CustomerDetails } from '../../hooks/use-customer-details';

const EMPTY_VALUE = '—';

interface InfoCellProps {
  value: string;
  label: string;
  icon?: ReactNode;
  href?: string;
}

function InfoCell({ value, label, icon, href }: InfoCellProps) {
  const display = value && value !== '-' ? value : EMPTY_VALUE;
  const isEmpty = display === EMPTY_VALUE;

  const content = (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-1">
        {icon}
        <div className="min-w-0 flex-1">
          <TruncateText>{display}</TruncateText>
        </div>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {label}
      </TruncateText>
    </div>
  );

  if (href && !isEmpty) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center transition-opacity hover:opacity-80"
      >
        {content}
      </a>
    );
  }

  return <div className="flex min-w-0 flex-1 items-center">{content}</div>;
}

interface CustomerDetailsTabProps {
  organization: CustomerDetails;
}

export function CustomerDetailsTab({ organization }: CustomerDetailsTabProps) {
  const hasWebsite = Boolean(organization.website && organization.website !== '-');
  const websiteHref = hasWebsite
    ? organization.website.startsWith('http')
      ? organization.website
      : `https://${organization.website}`
    : undefined;

  return (
    <div className="flex flex-col rounded-[6px] border border-ods-border bg-ods-card">
      <div className="flex h-20 items-center gap-4 border-b border-ods-border px-4">
        <InfoCell
          value={organization.website}
          label="Website"
          icon={<ExternalLinkIcon className="h-6 w-6 shrink-0 text-ods-text-secondary" />}
          href={websiteHref}
        />
      </div>
      <div className="flex flex-col px-4 py-4 md:h-20 md:flex-row md:items-center md:gap-4 md:py-0">
        <InfoCell value={organization.physicalAddress} label="Physical Address" />
        <InfoCell value={organization.mailingAddress} label="Mailing Address" />
      </div>
    </div>
  );
}
