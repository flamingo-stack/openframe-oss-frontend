'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RunScriptSkeleton } from '../../../scripts/v2/script/components/run-script-skeleton';
import RunScriptView from '../../../scripts/v2/script/components/run-script-view';

export default function RunScriptV2Page() {
  const id = useSearchParams().get('id') ?? '';

  return (
    <Suspense fallback={<RunScriptSkeleton scriptId={id} />}>
      <RunScriptView scriptId={id} />
    </Suspense>
  );
}
