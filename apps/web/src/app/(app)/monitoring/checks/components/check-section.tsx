import type { ReactNode } from 'react';

/** A titled block of the page: its uppercase label and actions on one row, its content under them. */
export function Section({ title, actions, children }: { title: string; actions: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex min-h-10 items-center justify-between gap-[var(--spacing-system-m)]">
        <h3 className="text-ods-text-secondary text-h5">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}
