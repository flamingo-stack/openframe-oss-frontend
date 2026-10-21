'use client';

import {
  FlamingoMarkIcon,
  OpenframeLogoIcon,
  OpenframeTextIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import type { ReactNode } from 'react';

/**
 * The frame of the standalone auth status pages (`/auth/error`, `/auth/verify`): the logo on top, the page's content
 * centered, "Powered by Flamingo" at the foot.
 */
export function AuthStatusFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-ods-bg p-10">
      <div className="flex items-center gap-2">
        <OpenframeLogoIcon
          secondaryColor="var(--color-accent-primary)"
          className="h-10 w-auto"
          color="var(--color-text-primary)"
        />
        <OpenframeTextIcon color="var(--color-text-primary)" style={{ width: '144px', height: '24px' }} />
      </div>

      {children}

      <a
        href="https://flamingo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-md bg-transparent p-4 text-ods-text-secondary transition-colors hover:bg-ods-bg-hover"
      >
        <span className="text-h6">Powered by</span>
        <FlamingoMarkIcon className="h-5 w-5" color="currentColor" />
        <span className="font-semibold text-code">Flamingo</span>
      </a>
    </div>
  );
}
