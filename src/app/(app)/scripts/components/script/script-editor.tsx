'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { Monaco } from '@monaco-editor/react';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Monaco's own line geometry, measured off a rendered editor: `.line-numbers`
 * is a 46×22 box, so the first character of every line sits at x=46 and each
 * line is 22px tall (the `lineHeight` option below). The top offset is the
 * `padding.top` those options set.
 */
const LINE_HEIGHT = 'h-[22px]';
const GUTTER_WIDTH = 'w-[46px]';
/** Where the digit sits: right-aligned in the gutter, a hair off its edge. */
const GUTTER_NUMBER_INSET = 'pr-[4px]';
/** The decoration strip between the gutter and the first character of the line. */
const CODE_COLUMN_INSET = 'pl-[16px]';
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
 * What covers the editor's box until Monaco is built AND has something to show.
 *
 * Monaco is the one control on these pages that cannot stand in for itself: it
 * IS the thing being loaded, and building a second instance to hold its place
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
                Monaco puts the line number. */}
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
const Editor = dynamic(() => import('@monaco-editor/react').then(m => m.default), {
  ssr: false,
  loading: () => null,
});

let prewarmStarted = false;

/**
 * Start fetching Monaco before anything asks for an editor.
 *
 * `@monaco-editor/react` is a 6 KB wrapper; Monaco itself is ~4 MB that
 * `@monaco-editor/loader` pulls at RUNTIME by injecting a `<script>` tag — a
 * string the bundler never sees, so no import strategy, dynamic or otherwise,
 * moves that cost. `loader.init()` fires on the wrapper's mount effect, which
 * means an editor revealed by a click pays ~3.6 MB of parsing inside that click,
 * freezing whatever animation the click started.
 *
 * Call this from a surface that MIGHT open an editor — a collapsed card, a tab
 * one click away — and the click finds Monaco already in memory. Idempotent and
 * idle-scheduled, so every card on a page may call it: one background request
 * that yields to the page's own data.
 */
export function prewarmScriptEditor(): void {
  if (prewarmStarted || typeof window === 'undefined') {
    return;
  }
  prewarmStarted = true;

  const start = () => {
    // The same `loader.init()` the Editor calls on mount, and it is idempotent:
    // a later mount reuses this exact promise rather than starting over. A
    // failure needs no handling here — the editor surfaces it the same way it
    // does without a prewarm, and swallowing it keeps a blocked CDN from
    // reaching the console as an unhandled rejection nobody asked for.
    import('@monaco-editor/react').then(({ loader }) => loader.init()).catch(() => {});
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
  // out first, so a several-megabyte prefetch nobody has asked for yet does not
  // race the data the user is actually waiting on.
  setTimeout(start, 1000);
}

/** Successive warm-ups on the timer fallback, so they do not land in one frame. */
let warmupSlot = 0;
const WARMUP_FALLBACK_BASE_MS = 1200;
const WARMUP_FALLBACK_STEP_MS = 400;
const WARMUP_FALLBACK_MAX_SLOTS = 8;

/**
 * Schedule building an editor that nobody has opened yet, and return a canceller.
 *
 * Worth the trouble because of HOW `@monaco-editor/react` mounts: it creates the
 * editor while its own container still carries `display: none`, so Monaco
 * measures itself as 0×0 and renders no lines; only when the wrapper drops that
 * style does `automaticLayout`'s ResizeObserver fire and lay the editor out for
 * real. Those two phases are unavoidable from outside the wrapper — but they are
 * invisible if they happen before anyone is looking. Build the editor inside a
 * region that is clipped rather than unmounted (its box is real, so Monaco
 * measures correctly) and the reveal has nothing left to do.
 *
 * Deliberately NO `timeout` on the idle callback: a page may warm several
 * editors, and building one is not cheap. Pure idle lets the browser space them
 * out — one long build exhausts that idle period and the rest wait for the next.
 * Nothing here is required for correctness, so nothing here needs a deadline.
 */
export function scheduleEditorWarmup(build: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(build);
    return () => window.cancelIdleCallback(handle);
  }

  const delay = WARMUP_FALLBACK_BASE_MS + Math.min(warmupSlot, WARMUP_FALLBACK_MAX_SLOTS) * WARMUP_FALLBACK_STEP_MS;
  warmupSlot += 1;
  const handle = window.setTimeout(build, delay);
  return () => {
    warmupSlot = Math.max(0, warmupSlot - 1);
    window.clearTimeout(handle);
  };
}

const ODS_THEME_NAME = 'ods-dark';

// Monaco's Safari/WebKit clipboard workaround cancels its pending clipboard-write
// promise on every click and logs the benign CancellationError as a console error
// (microsoft/monaco-editor#4389, unfixed upstream). Override the standalone log
// service to drop cancellation errors — the same treatment vscode's own
// onUnexpectedError gives them. Applied on the first editor mount, then shared by
// every Monaco instance on the page.
const noop = () => {};
const MONACO_SERVICE_OVERRIDES = {
  logService: {
    getLevel: () => 3, // LogLevel.Info — parity with monaco's default
    setLevel: noop,
    onDidChangeLogLevel: () => ({ dispose: noop }),
    trace: noop,
    debug: noop,
    info: (...args: unknown[]) => console.info(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => {
      const [head] = args;
      if (head instanceof Error && head.name === 'Canceled' && head.message === 'Canceled') return;
      console.error(...args);
    },
    flush: noop,
    dispose: noop,
  },
};

const SHELL_TO_LANGUAGE: Record<string, string> = {
  powershell: 'powershell',
  cmd: 'bat',
  bash: 'shell',
  python: 'python',
  nushell: 'shell',
  deno: 'typescript',
  shell: 'shell',
  sql: 'sql',
};

function defineOdsTheme(monaco: Monaco) {
  monaco.editor.defineTheme(ODS_THEME_NAME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'fafafa', background: '161616' },
      { token: 'comment', foreground: '747474', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ffc008' },
      { token: 'keyword.flow', foreground: 'ffc008' },
      { token: 'string', foreground: '5efaf0' },
      { token: 'string.escape', foreground: '44c8c0' },
      { token: 'number', foreground: 'f5b600' },
      { token: 'variable', foreground: 'fafafa' },
      { token: 'variable.predefined', foreground: '5efaf0' },
      { token: 'type', foreground: '5ea62e' },
      { token: 'function', foreground: '5ea62e' },
      { token: 'operator', foreground: '888888' },
      { token: 'delimiter', foreground: '888888' },
      { token: 'tag', foreground: 'ffc008' },
      { token: 'attribute.name', foreground: '5ea62e' },
      { token: 'attribute.value', foreground: '5efaf0' },
      { token: 'constant', foreground: 'f5b600' },
      { token: 'regexp', foreground: 'f36666' },
      { token: 'annotation', foreground: 'ffc008' },
      { token: 'metatag', foreground: 'ffc008' },
    ],
    colors: {
      'editor.background': '#161616',
      'editor.foreground': '#fafafa',
      'editor.lineHighlightBackground': '#21212180',
      'editor.selectionBackground': '#ffc00830',
      'editor.selectionHighlightBackground': '#ffc00815',
      'editor.inactiveSelectionBackground': '#3a3a3a40',
      'editorLineNumber.foreground': '#747474',
      'editorLineNumber.activeForeground': '#fafafa',
      'editorCursor.foreground': '#ffc008',
      'editorGutter.background': '#161616',
      'editorWidget.background': '#212121',
      'editorWidget.border': '#3a3a3a',
      'editorIndentGuide.background': '#3a3a3a40',
      'editorIndentGuide.activeBackground': '#3a3a3a80',
      'editorWhitespace.foreground': '#3a3a3a60',
      'editorBracketMatch.background': '#ffc00820',
      'editorBracketMatch.border': '#ffc00860',
      'editor.findMatchBackground': '#ffc00830',
      'editor.findMatchHighlightBackground': '#ffc00815',
      'editorOverviewRuler.border': '#3a3a3a',
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': '#3a3a3a60',
      'scrollbarSlider.hoverBackground': '#3a3a3a90',
      'scrollbarSlider.activeBackground': '#ffc00840',
      'input.background': '#212121',
      'input.border': '#3a3a3a',
      'input.foreground': '#fafafa',
      focusBorder: '#ffc008',
      'list.activeSelectionBackground': '#ffc00820',
      'list.hoverBackground': '#2b2b2b',
      'minimap.background': '#161616',
    },
  });
}

let themedMonaco: Monaco | null = null;

/**
 * Register the ODS theme once per Monaco instance, not once per editor.
 *
 * `defineTheme` is not a cheap re-registration when the theme is the ACTIVE one:
 * monaco's `StandaloneThemeService` answers it with `this.setTheme(themeName)`
 * to refresh, which regenerates the color map and re-tokenizes EVERY editor
 * already on the page. Left in `beforeMount`, opening the fourth editor of a
 * list re-tokenizes the three before it.
 *
 * Keyed on the instance rather than a plain flag so a Monaco that was somehow
 * re-initialized gets its theme back instead of silently rendering unthemed.
 */
function ensureOdsTheme(monaco: Monaco) {
  if (themedMonaco === monaco) {
    return;
  }
  themedMonaco = monaco;
  defineOdsTheme(monaco);
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
   * The `value` is still on its way. Keeps the placeholder up past the point
   * Monaco is built, so the editor is revealed WITH its content instead of
   * appearing empty and filling in a moment later.
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
  const editorRef = useRef<ReturnType<Monaco['editor']['create']> | null>(null);
  const [isEditorBuilt, setIsEditorBuilt] = useState(false);

  const language = SHELL_TO_LANGUAGE[shell.toLowerCase()] || 'shell';

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    ensureOdsTheme(monaco);
  }, []);

  // `onMount` fires once the editor exists and has laid its first frame out, so
  // this is the earliest moment there is anything worth revealing.
  const handleMount = useCallback((editor: ReturnType<Monaco['editor']['create']>) => {
    editorRef.current = editor;
    setIsEditorBuilt(true);
  }, []);

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange?.(val ?? '');
    },
    [onChange],
  );

  // Memoized because the wrapper watches this object by IDENTITY: a fresh literal
  // makes it call `editor.updateOptions()` on every render of this component,
  // which re-validates the whole option set and can re-render the editor. Nothing
  // in here varies but `readOnly`.
  const options = useMemo(
    () => ({
      readOnly,
      fontSize: 14,
      fontFamily: 'var(--font-azeret-mono), "SF Mono", Monaco, Inconsolata, Consolas, monospace',
      lineHeight: 22,
      minimap: { enabled: !readOnly },
      scrollBeyondLastLine: false,
      wordWrap: 'off' as const,
      automaticLayout: true,
      tabSize: 2,
      renderLineHighlight: (readOnly ? 'none' : 'line') as 'none' | 'line',
      cursorBlinking: 'smooth' as const,
      cursorSmoothCaretAnimation: 'on' as const,
      smoothScrolling: true,
      padding: { top: 12, bottom: 12 },
      bracketPairColorization: { enabled: true },
      matchBrackets: 'always' as const,
      suggest: {
        showKeywords: true,
        showSnippets: true,
      },
      quickSuggestions: !readOnly,
      folding: true,
      foldingHighlight: true,
      lineNumbers: 'on' as const,
      glyphMargin: false,
      lineDecorationsWidth: 0,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      domReadOnly: readOnly,
      contextmenu: !readOnly,
      scrollbar: {
        vertical: 'auto' as const,
        horizontal: 'auto' as const,
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        useShadows: false,
        alwaysConsumeMouseWheel: false,
      },
    }),
    [readOnly],
  );

  return (
    // The frame carries the height itself, so the box is the editor's size from
    // the very first paint: the wrapper is code-split, and a placeholder sized by
    // its content would let the page collapse and jump back while the chunk is
    // still in flight.
    <div
      style={{ height }}
      className={cn(
        'relative rounded-md border overflow-hidden',
        invalid ? 'border-ods-error' : 'border-ods-border',
        className,
      )}
    >
      {/* Monaco is NOT hidden while it sets up — the placeholder simply covers
          it. A `display: none` editor measures itself as 0×0 and lays out only
          once it is shown, which is the second flash this is meant to prevent;
          under an opaque overlay it builds at its real size, off screen but not
          out of layout. */}
      <Editor
        height={height}
        language={language}
        value={value}
        theme={ODS_THEME_NAME}
        overrideServices={MONACO_SERVICE_OVERRIDES}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={handleChange}
        loading={null}
        options={options}
      />
      <ScriptEditorPlaceholder visible={!isEditorBuilt || loading} />
    </div>
  );
}
