'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { BrewPackageType, PackageManagerType, SoftwareAction } from '@/generated/schema-enums';
import { type SoftwarePackageRuns, SoftwareExecutionsView } from '../components/software-executions-view';
import { softwarePageErrorFallback } from '../components/software-page-error';

function oneOf<T extends string>(values: Record<string, T>, value: string | null): T | null {
  return value && (Object.values(values) as string[]).includes(value) ? (value as T) : null;
}

/** The package the URL points at, or null when the link is truncated or hand-edited. */
function useRunsParam(): SoftwarePackageRuns | null {
  const params = useSearchParams();
  const packageManager = oneOf(PackageManagerType, params.get('manager'));
  const action = oneOf(SoftwareAction, params.get('action'));
  const packageName = params.get('package');
  if (!packageManager || !action || !packageName) return null;
  return { packageManager, action, packageName, brewPackageType: oneOf(BrewPackageType, params.get('type')) };
}

export default function SoftwareExecutionsPage() {
  const runs = useRunsParam();

  return (
    <div className="flex w-full flex-col">
      <div className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        {runs ? (
          <ContentErrorBoundary
            fallback={softwarePageErrorFallback('Software Update Details', "Couldn't load these runs.")}
          >
            <SoftwareExecutionsView runs={runs} />
          </ContentErrorBoundary>
        ) : (
          <NotFoundError message="This link doesn't point at a software package." />
        )}
      </div>
    </div>
  );
}
