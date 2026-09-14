'use client';

import { useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptDetailsView } from '../script/components/script-details-view';

export default function ScriptDetailsPage() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <ContentErrorBoundary title="Script" message="Couldn't load this script.">
      <ScriptDetailsView scriptId={id} />
    </ContentErrorBoundary>
  );
}
