import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type React from 'react';

/**
 * InfoCell — reusable cell with primary value and secondary label, used in
 * detail/info card layouts. Maps to the ODS h3/h6 typography tokens.
 *
 * Examples:
 * - `<InfoCell value="workstation-23.acme.local" label="Hostname" />`
 * - `<InfoCell value={<>{date} <span className="...">{time}</span></>} label="Updated" />`
 * - `<InfoCell value="Laptop" label="Type" icon={<LaptopIcon />} />`
 * - `<InfoCell value="example.com" label="Website" href="https://example.com" />`
 */
export interface InfoCellProps {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  /** When set, the whole cell becomes an external link. */
  href?: string;
  className?: string;
}

export function InfoCell({ value, label, icon, href, className }: InfoCellProps) {
  const content = (
    <div className={`flex min-w-0 flex-1 flex-col justify-center ${className ?? ''}`}>
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {icon && <span className="shrink-0">{icon}</span>}
        {typeof value === 'string' ? (
          <div className="min-w-0 flex-1">
            <TruncateText>{value}</TruncateText>
          </div>
        ) : (
          <div className="truncate text-ods-text-primary text-h4">{value}</div>
        )}
      </div>
      <p className="truncate text-ods-text-secondary text-h6">{label}</p>
    </div>
  );

  if (href) {
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

  return content;
}
