'use client';

import { useSearchParams } from 'next/navigation';
import { ContentErrorBoundary } from '@/app/components/shared';
import { ScriptDetailsView } from '../../scripts/v2/script/components/script-details-view';

export default function ScriptDetailsV2Page() {
  const id = useSearchParams().get('id') ?? '';
  return (
    <ContentErrorBoundary title="Script" message="Couldn't load this script.">
      <ScriptDetailsView scriptId={id} />
    </ContentErrorBoundary>
  );
}
