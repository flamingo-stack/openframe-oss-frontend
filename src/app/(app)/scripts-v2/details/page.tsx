'use client';

import { useSearchParams } from 'next/navigation';
import { ScriptDetailsView } from '../../scripts/v2/script/components/script-details-view';

export default function ScriptDetailsV2Page() {
  const id = useSearchParams().get('id') ?? '';
  return <ScriptDetailsView scriptId={id} />;
}
