'use client';

import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';

/** How many lines a status screen's read paragraph typically runs to (the auth error, the inactive workspace). */
const PARAGRAPH_SKELETON_LINES = 2;

/** The paragraph while its copy is not known yet: its typical lines in the paragraph's own type step, at its width. */
function LoadingParagraphSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="w-full">
      <TextLineSkeleton type="h4" lines={PARAGRAPH_SKELETON_LINES} className="w-full" />
    </LoadingRegion>
  );
}

/**
 * A status screen's body paragraph whose copy is read (the auth server's error description, the viewer's role):
 * its own skeleton while `text` is undefined, `loading` is set, or in a loading scope.
 */
export function LoadingParagraph({ text, loading, label }: { text?: string; loading?: boolean; label: string }) {
  if (useLoadingScope() || !!loading || text === undefined) return <LoadingParagraphSkeleton label={label} />;
  return <p className="text-ods-text-secondary text-h4">{text}</p>;
}
