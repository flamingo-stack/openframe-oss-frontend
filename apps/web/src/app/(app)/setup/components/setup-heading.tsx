import { OpenframeLogoIcon, OpenframeTextIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';

/**
 * Logo, title and lead of a wizard screen, centred as the design draws them.
 * Wider than the step bodies: the desktop title runs on one line at 990px and
 * the lead wraps at 730px, while forms and cards below stay at 600px.
 */
export function SetupHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex w-full max-w-[990px] flex-col items-center gap-[var(--spacing-system-l)] text-center">
      <div className="flex items-center gap-[var(--spacing-system-xsf)]">
        <OpenframeLogoIcon
          secondaryColor="var(--color-accent-primary)"
          className="h-10 w-auto"
          color="var(--color-text-primary)"
        />
        <OpenframeTextIcon color="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>
      <div className="flex flex-col items-center gap-[var(--spacing-system-s)]">
        <h1 className="text-ods-text-primary text-h1">{title}</h1>
        {subtitle && <p className="max-w-[730px] text-ods-text-secondary text-h4">{subtitle}</p>}
      </div>
    </div>
  );
}
