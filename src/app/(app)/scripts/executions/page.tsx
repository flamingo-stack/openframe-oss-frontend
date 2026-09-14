'use client';

import { useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptExecutionDetailsView } from '../script/components/script-execution-details-view';

export default function ScriptExecutionDetailsPage() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <ContentErrorBoundary title="Execution" message="Couldn't load this execution.">
      <ScriptExecutionDetailsView executionId={id} />
    </ContentErrorBoundary>
  );
}
