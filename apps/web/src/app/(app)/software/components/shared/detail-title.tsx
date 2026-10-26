'use client';

import { TitleBlock } from '@flamingo-stack/openframe-frontend-core';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useSafeBack } from '@/app/hooks/use-safe-back';

interface DetailTitleProps {
  title: string;
  /** Where Back goes when there is no history to return to. */
  backTo: string;
  /** The title is the record's answer and it is still loading — drawn as a bar (so it is in a loading scope). */
  loading?: boolean;
}

/**
 * A Software detail page's title and Back button, for the pages whose title is
 * the record itself. Back works while the record loads and for an id with no
 * record, since the way out has to survive both.
 */
export function DetailTitle({ title, backTo, loading }: DetailTitleProps) {
  const inScope = useLoadingScope();
  const handleBack = useSafeBack(backTo);
  return <TitleBlock title={title} loading={loading || inScope} backButton={{ label: 'Back', onClick: handleBack }} />;
}
