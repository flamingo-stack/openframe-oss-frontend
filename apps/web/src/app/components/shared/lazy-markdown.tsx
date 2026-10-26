'use client';

import type {
  MarkdownEditor as MarkdownEditorType,
  SimpleMarkdownRenderer as SimpleMarkdownRendererType,
} from '@flamingo-stack/openframe-frontend-core';
import {
  MarkdownEditorFieldSkeleton,
  MarkdownEngineSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

type SimpleMarkdownRendererProps = ComponentProps<typeof SimpleMarkdownRendererType>;
type MarkdownEditorProps = ComponentProps<typeof MarkdownEditorType>;

/**
 * The markdown renderer, its code split out of the page bundle. While the code loads the `next/dynamic` fallback
 * draws the renderer's own skeleton.
 */
export const SimpleMarkdownRenderer = dynamic<SimpleMarkdownRendererProps>(
  () => import('@flamingo-stack/openframe-frontend-core').then(m => m.SimpleMarkdownRenderer),
  { ssr: false, loading: () => <MarkdownEngineSkeleton /> },
);

/**
 * The markdown editor at a form's field height, its code split out of the page bundle. A `next/dynamic` fallback
 * takes no props, so the height is bound here: the fallback draws the editor's field skeleton at it, and the form
 * passes the same constant as the editor's `height`. Call it once per height, at module level.
 */
export function lazyMarkdownEditor(height: number) {
  return dynamic<MarkdownEditorProps>(
    () => import('@flamingo-stack/openframe-frontend-core/components/ui').then(m => m.MarkdownEditor),
    { ssr: false, loading: () => <MarkdownEditorFieldSkeleton height={height} /> },
  );
}
