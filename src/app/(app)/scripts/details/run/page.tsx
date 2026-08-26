'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RunScriptSkeleton } from '../../script/components/run-script-skeleton';
import RunScriptView from '../../script/components/run-script-view';

export default function RunScriptPage() {
  const id = useSearchParams().get('id') ?? '';

  return (
    <Suspense fallback={<RunScriptSkeleton scriptId={id} />}>
      <RunScriptView scriptId={id} />
    </Suspense>
  );
}
