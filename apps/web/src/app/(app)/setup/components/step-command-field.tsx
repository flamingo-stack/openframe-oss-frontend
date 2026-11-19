import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { ReactNode } from 'react';

/**
 * The Deploy First Device step's one-line field: the install command, and the
 * client logs folder under the "not connected" notice. One box, so the two
 * read as the same kind of thing at the same size.
 *
 * Not the lib's `CommandBox`: that one paints the page ground with a fixed
 * 16px padding, and the step's design draws these fields on the card ground
 * at the responsive spacing.
 */
export const STEP_COMMAND_FIELD_CLASS =
  'flex w-full items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)]';

export function StepCommandField({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(STEP_COMMAND_FIELD_CLASS, className)}>{children}</div>;
}
