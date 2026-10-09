import { OpenFrameLogo, OpenFrameText } from '@flamingo-stack/openframe-frontend-core/components/icons';
import type { ReactNode } from 'react';

/** Logo, title and lead of a wizard screen, centred as the design draws them. */
export function SetupHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-[var(--spacing-system-l)] text-center">
      <div className="flex items-center gap-[var(--spacing-system-xxs)]">
        <OpenFrameLogo
          className="h-6 w-auto"
          lowerPathColor="var(--color-accent-primary)"
          upperPathColor="var(--color-text-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" style={{ width: '96px', height: '16px' }} />
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-s)]">
        <h1 className="text-ods-text-primary text-h1">{title}</h1>
        {subtitle && <p className="text-ods-text-secondary text-h4">{subtitle}</p>}
      </div>
    </div>
  );
}
