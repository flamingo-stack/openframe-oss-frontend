'use client';

import { useSearchParams } from 'next/navigation';
import RunScriptView from '../../script/components/run-script-view';

export default function RunScriptPage() {
  const id = useSearchParams().get('id') ?? '';

  // The view owns its Suspense boundary: while the script loads it draws itself without it.
  return <RunScriptView scriptId={id} />;
}
