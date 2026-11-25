import { AlertTriangleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * The design system's "Alert" callout (Figma: triangle icon, bold title, a caption line under it), over the core
 * lib's `Alert` in its `warning` or `error` variant. For a notice that explains a state, not a form error: the
 * device page when an agent does not run on the device's OS, the install steps' macOS requirement.
 *
 * The design's v2 attention colours (error/warning sec, border, text) are not ODS tokens yet; the lib variant's
 * tokens stand in for them.
 */
export function AttentionAlert({
  variant,
  title,
  description,
  ...rest
}: {
  variant: 'warning' | 'error';
  title: ReactNode;
  description?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <Alert
      variant={variant}
      // A standing notice, not an interruption: announced politely (the lib's default is role="alert").
      role="status"
      className="flex items-center gap-[var(--spacing-system-mf)] rounded-[6px] p-[var(--spacing-system-mf)]"
      {...rest}
    >
      <span className="shrink-0" aria-hidden>
        <AlertTriangleIcon size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
        <p className="break-words text-h3">{title}</p>
        {description ? <p className="break-words text-h6">{description}</p> : null}
      </div>
    </Alert>
  );
}
