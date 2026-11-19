import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

/**
 * The Deploy First Device step's one-line field: the install command, and the
 * client logs folder under the "not connected" notice. One box, so the two
 * read as the same kind of thing at the same size.
 */
export const COMMAND_BOX_CLASS =
  'flex w-full items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]';

export function CommandBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(COMMAND_BOX_CLASS, className)}>{children}</div>;
}
