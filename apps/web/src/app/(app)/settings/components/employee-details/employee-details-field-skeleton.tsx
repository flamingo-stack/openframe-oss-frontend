import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';

/** A value bar above its label bar — one field of the employee card. */
export function EmployeeDetailsFieldSkeleton({ valueClassName }: { valueClassName: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-[var(--spacing-system-xxs)]">
      <UnifiedSkeleton className={valueClassName} />
      <UnifiedSkeleton className="h-4 w-16" />
    </div>
  );
}
