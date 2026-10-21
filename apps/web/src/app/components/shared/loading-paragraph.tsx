'use client';

import { LoadingRegion, TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';

/** How many lines a status screen's read paragraph typically runs to (the auth error, the inactive workspace). */
const PARAGRAPH_SKELETON_LINES = 2;

/** A paragraph's typical line count: one number, or one below the `content-md` breakpoint and one from it. */
export type ParagraphLines = number | { base: number; md: number };

const TYPE_CLASS = { h4: 'text-h4', h6: 'text-h6' } as const;
const TONE_CLASS = { primary: 'text-ods-text-primary', secondary: 'text-ods-text-secondary' } as const;

export interface LoadingParagraphProps {
  /** The paragraph's copy; `undefined` while it is read. */
  text?: string;
  /** The copy is not here yet. A loading scope does the same. */
  loading?: boolean;
  /** Announced while loading; omit inside a region that already announces itself. */
  label?: string;
  /** The type step (h4 body, h6 caption). */
  type?: keyof typeof TYPE_CLASS;
  tone?: keyof typeof TONE_CLASS;
  /** Extra classes of the loaded paragraph (`whitespace-pre-wrap` for a note). */
  className?: string;
  /** The typical line count drawn while loading (a declared constant at the call site). */
  lines?: ParagraphLines;
}

/** The paragraph while its copy is not known yet: its typical lines in the paragraph's own type step, at its width. */
function LoadingParagraphSkeleton({ type, lines }: { type: keyof typeof TYPE_CLASS; lines: ParagraphLines }) {
  if (typeof lines === 'number') return <TextLineSkeleton type={type} lines={lines} className="w-full" />;
  return (
    <>
      <TextLineSkeleton type={type} lines={lines.base} className="w-full content-md:hidden" />
      <TextLineSkeleton type={type} lines={lines.md} className="hidden w-full content-md:flex" />
    </>
  );
}

/**
 * A paragraph whose copy is read (the auth server's error description, a CVE's description, a customer's notes): its
 * typical lines while `text` is undefined, `loading` is set, or in a loading scope; the paragraph once it is known.
 */
export function LoadingParagraph({
  text,
  loading,
  label,
  type = 'h4',
  tone = 'secondary',
  className,
  lines = PARAGRAPH_SKELETON_LINES,
}: LoadingParagraphProps) {
  if (useLoadingScope() || !!loading || text === undefined) {
    const skeleton = <LoadingParagraphSkeleton type={type} lines={lines} />;
    return label ? (
      <LoadingRegion label={label} className="w-full">
        {skeleton}
      </LoadingRegion>
    ) : (
      skeleton
    );
  }
  return <p className={cn(TONE_CLASS[tone], TYPE_CLASS[type], className)}>{text}</p>;
}
