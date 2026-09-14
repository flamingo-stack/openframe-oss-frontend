'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

/**
 * The editor's own line geometry, set by the theme in `script-editor-view.tsx`:
 * the line-number gutter is a 46px column, the fold gutter is a 16px column
 * after it, each line is 22px tall, and the code starts 16px past both. The top
 * offset is that theme's `.cm-content` padding. Those rules and these constants
 * have to agree, or the swap from placeholder to editor slides — verified in the
 * browser at 46 + 16 + 16 = 78px to the first character.
 */
const LINE_HEIGHT = 'h-[22px]';
const GUTTER_WIDTH = 'w-[46px]';
/** Where the digit sits: right-aligned in the gutter, a hair off its edge. */
const GUTTER_NUMBER_INSET = 'pr-[4px]';
/**
 * From the end of the line-number gutter to the first character: the 16px fold
 * column plus the line's own 16px padding. Two columns, one inset here, because
 * the placeholder draws no fold chevron of its own.
 */
const CODE_COLUMN_INSET = 'pl-[32px]';
/** One indent step = `tabSize` 2 at ~8.4px per character of 14px Azeret Mono. */
const PLACEHOLDER_INDENTS = ['ml-0', 'ml-[17px]', 'ml-[34px]'];

/**
 * Rows of {@link ScriptEditorPlaceholder}: an indent step and a width each, so
 * the box reads as code waiting to arrive rather than as a grey slab. Widths are
 * of the CODE column, the part right of the gutter.
 */
const PLACEHOLDER_ROWS = [
  { indent: 0, width: 'w-[42%]' },
  { indent: 1, width: 'w-[66%]' },
  { indent: 1, width: 'w-[51%]' },
  { indent: 2, width: 'w-[37%]' },
  { indent: 1, width: 'w-[60%]' },
  { indent: 0, width: 'w-[26%]' },
  { indent: 0, width: 'w-[45%]' },
  { indent: 1, width: 'w-[33%]' },
];

/**
 * What covers the editor's box until the editor is built AND has something to
 * show.
 *
 * The editor is the one control on these pages that cannot stand in for itself:
 * it IS the thing being loaded, and building a second instance to hold its place
 * costs more than the fidelity is worth. So the box keeps the editor's own
 * background and line rhythm (22px rows, a gutter column, code-shaped lines of
 * varying width) — the same geometry the real editor drops into.
 *
 * `visible` fades it rather than unmounting it: this element is rendered in ONE
 * place for the editor's whole life, so nothing about it restarts. It stays
 * mounted afterwards, without the pulse, so an editor that goes back to loading
 * (a new script id on the same page) resumes instead of flashing in.
 */
function ScriptEditorPlaceholder({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'absolute inset-0 overflow-hidden bg-ods-bg py-3 transition-opacity duration-200 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {visible && (
        <span role="status" className="sr-only">
          Loading editor…
        </span>
      )}
      {/* One pulse on the group rather than per line: rows blinking out of step
          read as content, which is exactly what this is not. Dropped once the
          editor is up so a hidden layer costs no animation frames. */}
      <div className={visible ? 'animate-pulse' : undefined}>
        {PLACEHOLDER_ROWS.map((row, index) => (
          <div key={`${index}-${row.width}`} className={cn('flex items-center', LINE_HEIGHT)}>
            {/* The gutter: a digit's worth of bar, right-aligned exactly where
                the line number goes. */}
            <div className={cn('flex shrink-0 justify-end', GUTTER_WIDTH, GUTTER_NUMBER_INSET)}>
              <div className="h-3 w-2 rounded-sm bg-ods-border opacity-50" />
            </div>
            <div className={cn('min-w-0 flex-1 pr-4', CODE_COLUMN_INSET)}>
              <div className={cn('h-3 rounded-sm bg-ods-border', PLACEHOLDER_INDENTS[row.indent], row.width)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// No `loading` of its own: the placeholder belongs to the frame below, which
// outlives every stage. Handing one to `dynamic` too would mount a second copy
// in a different tree position, and the swap between them restarts the pulse —
// the flash this component exists to avoid.
const Editor = dynamic(() => import('./script-editor-view'), {
  ssr: false,
  loading: () => null,
});

let prewarmStarted = false;

/**
 * Start fetching the editor's chunk before anything asks for an editor.
 *
 * CodeMirror is a real import, so the bundler code-splits it behind the
 * `dynamic()` above and the chunk is fetched on the first render of an editor —
 * inside whatever click revealed it. Building the view once the chunk is there
 * costs a frame or two; fetching it over the network does not, and that is the
 * part worth moving off the click.
 *
 * Call this from a surface that MIGHT open an editor — a collapsed card, a tab
 * one click away — and the click finds the chunk already in memory. Idempotent
 * and idle-scheduled, so every card on a page may call it: one background
 * request that yields to the page's own data.
 */
export function prewarmScriptEditor(): void {
  if (prewarmStarted || typeof window === 'undefined') {
    return;
  }
  prewarmStarted = true;

  // A failure needs no handling here: the editor surfaces it the same way it
  // does without a prewarm, and swallowing it keeps a dropped chunk from
  // reaching the console as an unhandled rejection nobody asked for.
  const start = () => {
    import('./script-editor-view').catch(() => {});
  };

  // Feature-tested by `typeof`, not `in`: the DOM lib declares this on `Window`
  // unconditionally, so `'requestIdleCallback' in window` narrows the negative
  // branch to `never` and the fallback stops type-checking.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 2000 });
    return;
  }
  // WebKit only shipped `requestIdleCallback` in Safari 18.4, so this branch is
  // real — and it is the one branch that cannot ask the browser when it is free.
  // The delay stands in for that: enough for the page's own queries to have gone
  // out first, so a prefetch nobody has asked for yet does not race the data the
  // user is actually waiting on.
  setTimeout(start, 1000);
}

interface ScriptEditorProps {
  value: string;
  onChange?: (value: string) => void;
  shell?: string;
  readOnly?: boolean;
  height?: string;
  /** Render an error border (e.g. when the bound form field is invalid). */
  invalid?: boolean;
  /**
   * The `value` is still on its way. Keeps the placeholder up past the point the
   * editor is built, so it is revealed WITH its content instead of appearing
   * empty and filling in a moment later.
   */
  loading?: boolean;
  /**
   * Merged into the framing wrapper. For editors embedded in a surface that
   * already draws its own edges — pass `rounded-none border-0` to drop the
   * standalone card look.
   */
  className?: string;
}

export function ScriptEditor({
  value,
  onChange,
  shell = 'bash',
  readOnly = false,
  height = '400px',
  invalid = false,
  loading = false,
  className,
}: ScriptEditorProps) {
  const [isEditorBuilt, setIsEditorBuilt] = useState(false);

  // Fires once the view exists. Its geometry is measured a frame later (the
  // editor defers that to a `requestMeasure`), which costs nothing here because
  // the frame below carries the height itself.
  const handleReady = useCallback(() => setIsEditorBuilt(true), []);

  return (
    // The frame carries the height itself, so the box is the editor's size from
    // the very first paint: the editor is code-split, and a placeholder sized by
    // its content would let the page collapse and jump back while the chunk is
    // still in flight.
    <div
      style={{ height }}
      className={cn(
        'relative overflow-hidden rounded-md border',
        invalid ? 'border-ods-error' : 'border-ods-border',
        className,
      )}
    >
      {/* The editor is NOT hidden while it sets up — the placeholder simply
          covers it, so it builds and measures at its real size under an opaque
          layer rather than laying out in a zero-height box. */}
      <Editor value={value} onChange={onChange} shell={shell} readOnly={readOnly} onReady={handleReady} />
      <ScriptEditorPlaceholder visible={!isEditorBuilt || loading} />
    </div>
  );
}
