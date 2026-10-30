import type { HTMLAttributes, ReactNode } from 'react';

interface TenantNoticeProps extends HTMLAttributes<HTMLDivElement> {
  icon: ReactNode;
  title: string;
  description?: string | null;
}

/** A neutral fact about the tenant, on the card surface (Figma 3051-7925, 3065-17490): nothing to fix, only to know. */
export function TenantNotice({ icon, title, description, ...props }: TenantNoticeProps) {
  return (
    <div
      {...props}
      role="status"
      className="flex items-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]"
    >
      <span className="shrink-0 text-ods-text-secondary">{icon}</span>
      <div className="flex min-w-0 flex-col">
        <p className="text-ods-text-primary text-h3">{title}</p>
        {description && <p className="text-ods-text-secondary text-h6">{description}</p>}
      </div>
    </div>
  );
}
