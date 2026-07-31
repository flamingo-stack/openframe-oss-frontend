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
    <div className="flex flex-col justify-center min-w-0 flex-1">
      <div className="flex items-center gap-1 min-w-0">
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
        className="flex items-center min-w-0 flex-1 hover:opacity-80 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return <div className="flex items-center min-w-0 flex-1">{content}</div>;
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
    <div className="bg-ods-card border border-ods-border rounded-[6px] flex flex-col">
      <div className="flex gap-4 px-4 h-20 items-center border-b border-ods-border">
        <InfoCell
          value={organization.website}
          label="Website"
          icon={<ExternalLinkIcon className="w-6 h-6 text-ods-text-secondary shrink-0" />}
          href={websiteHref}
        />
      </div>
      <div className="flex flex-col md:flex-row md:gap-4 px-4 py-4 md:py-0 md:h-20 md:items-center">
        <InfoCell value={organization.physicalAddress} label="Physical Address" />
        <InfoCell value={organization.mailingAddress} label="Mailing Address" />
      </div>
    </div>
  );
}
