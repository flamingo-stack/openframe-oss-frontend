import { Skeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { SetupFrame } from './setup-frame';

/** The wizard's loading shape: its frame with a heading-sized placeholder. */
export function SetupSkeleton() {
  return (
    <SetupFrame step="welcome">
      <div className="flex w-full flex-col items-center gap-[var(--spacing-system-l)]">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-14 w-full max-w-[480px] rounded-md" />
        <Skeleton className="h-10 w-full max-w-[400px] rounded-md" />
      </div>
    </SetupFrame>
  );
}
