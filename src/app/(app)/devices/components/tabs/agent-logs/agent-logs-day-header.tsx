import type { ReactNode } from 'react';

interface AgentLogsDayHeaderProps {
  /** Names the day's group (`aria-labelledby`); the skeleton renders it without one. */
  id?: string;
  children: ReactNode;
}

/** The local-day separator above a day's rows — shared with the skeleton so the first rows land in place. */
export function AgentLogsDayHeader({ id, children }: AgentLogsDayHeaderProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)] pb-[var(--spacing-system-xxs)] pt-[var(--spacing-system-s)]">
      <span id={id} className="text-ods-text-secondary text-h5">
        {children}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-ods-border" />
    </div>
  );
}
