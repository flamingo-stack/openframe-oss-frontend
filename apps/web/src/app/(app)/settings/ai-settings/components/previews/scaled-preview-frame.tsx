'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/** The Fae window's default size (Tauri `width`/`height`): both previews lay out at it. */
export const FAE_WINDOW_WIDTH = 1024;
export const FAE_WINDOW_HEIGHT = 800;

/** The frame's box: the Fae window's aspect at the card's width. The loading thumbnails draw the same box. */
export const PREVIEW_FRAME_CLASS = 'relative aspect-[1024/800] w-full overflow-hidden rounded-md';

/**
 * A 1024×800 source layout shrunk to the card's width. The scale is measured,
 * not a per-breakpoint constant: the card's width follows the content area
 * (a docked Mingo panel narrows it without any breakpoint changing), and a
 * transform is used rather than `zoom`, which mis-renders text in Safari.
 */
export function ScaledPreviewFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / FAE_WINDOW_WIDTH));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={cn(PREVIEW_FRAME_CLASS, 'border border-ods-border bg-ods-bg')}>
      {/* Hidden until measured, so the first paint is not the layout at 1:1. */}
      {scale !== null && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: FAE_WINDOW_WIDTH, height: FAE_WINDOW_HEIGHT, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
