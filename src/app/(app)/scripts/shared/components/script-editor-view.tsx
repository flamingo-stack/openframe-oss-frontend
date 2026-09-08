'use client';

import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentUnit,
  StreamLanguage,
  syntaxHighlighting,
} from '@codemirror/language';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Annotation, Compartment, EditorState, type Extension, Transaction } from '@codemirror/state';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The editor itself — everything that pulls CodeMirror in.
 *
 * Split from `script-editor.tsx` so the library lands in its own chunk: the
 * wrapper, its placeholder and the box's geometry are what every page importing
 * an editor pays for, and this file is what only the pages that actually reveal
 * one do. `prewarmScriptEditor` fetches this module.
 */

/**
 * The `ods-dark` palette, ported from the monaco theme this replaced.
 *
 * The geometry here is load-bearing, not taste: `ScriptEditorPlaceholder` draws
 * the same box, so the two have to agree to the pixel or the swap slides. The
 * rules that set it are marked `← placeholder` below, and together they put the
 * first character at 46 (line numbers) + 16 (fold column) + 16 (line padding) =
 * 78px, on 22px rows, 12px down. Change one, change its twin in
 * `script-editor.tsx`.
 */
const odsTheme = EditorView.theme(
  {
    '&': { color: '#fafafa', backgroundColor: '#161616', height: '100%' },
    '&.cm-focused': { outline: 'none' },
    // Fixed-height editor: the frame owns the height, the scroller owns the overflow.
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'var(--font-azeret-mono), "SF Mono", Monaco, Inconsolata, Consolas, monospace',
      fontSize: '14px',
      lineHeight: '22px', // ← placeholder row height
    },
    '.cm-content': { padding: '12px 0', caretColor: '#ffc008' }, // ← placeholder top offset
    '.cm-line': { padding: '0 16px' }, // ← placeholder code-column inset
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#ffc008' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: '#ffc00830',
    },
    '.cm-selectionMatch': { backgroundColor: '#ffc00815' },
    '.cm-activeLine': { backgroundColor: '#21212180' },
    '.cm-gutters': { backgroundColor: '#161616', color: '#747474', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '46px', padding: '0 4px 0 0' }, // ← placeholder gutter
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#fafafa' },
    // Folding is a SECOND gutter column here, where monaco drew its arrows
    // inside the line-number rail. Its natural width is the chevron's glyph
    // metrics (measured 11.1px), which is both font-dependent and not a round
    // number — pinned so the rail is a deterministic 46 + 16 = 62px and the
    // placeholder can be told where the code starts. ← placeholder fold column
    '.cm-foldGutter .cm-gutterElement': { width: '16px', padding: '0', textAlign: 'center', color: '#747474' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: '#ffc00820',
      outline: '1px solid #ffc00860',
    },
    '.cm-nonmatchingBracket': { outline: '1px solid #f3666660' },
    // The search panel — monaco themed its find widget through `editorWidget.*`.
    '.cm-panels': { backgroundColor: '#212121', color: '#fafafa', border: 'none' },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid #3a3a3a' },
    '.cm-panel button': { backgroundColor: '#212121', color: '#fafafa', border: '1px solid #3a3a3a' },
    '.cm-panel input, .cm-textfield': {
      backgroundColor: '#212121',
      color: '#fafafa',
      border: '1px solid #3a3a3a',
    },
    '.cm-searchMatch': { backgroundColor: '#ffc00815' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: '#ffc00830' },
  },
  { dark: true },
);

/**
 * The monaco rules re-derived against lezer tags, which is the only way across:
 * the two token vocabularies do not correspond. `keyword.flow` and
 * `variable.predefined` are monarch names with no lezer equivalent, and the
 * stream modes below emit CodeMirror 5 names that `@codemirror/language` maps
 * through a fixed table on the way in — `builtin` arrives as
 * `variableName.standard`, `variable-2` as `variableName.special`, `def` as
 * `variableName.definition`. Those three carry most of a shell script's colour,
 * so they are spelled out rather than left to fall through to the default.
 */
const odsHighlight = HighlightStyle.define(
  [
    { tag: t.comment, color: '#747474', fontStyle: 'italic' },
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#ffc008' },
    { tag: [t.modifier, t.meta, t.annotation], color: '#ffc008' },
    { tag: [t.string, t.special(t.string)], color: '#5efaf0' },
    { tag: t.escape, color: '#44c8c0' },
    { tag: [t.number, t.bool, t.null, t.atom], color: '#f5b600' },
    { tag: t.variableName, color: '#fafafa' },
    { tag: t.special(t.variableName), color: '#5efaf0' },
    { tag: [t.standard(t.variableName), t.definition(t.variableName)], color: '#5ea62e' },
    { tag: [t.typeName, t.className, t.namespace], color: '#5ea62e' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#5ea62e' },
    { tag: t.propertyName, color: '#fafafa' },
    { tag: [t.operator, t.derefOperator, t.punctuation, t.separator, t.bracket], color: '#888888' },
    { tag: t.tagName, color: '#ffc008' },
    { tag: t.attributeName, color: '#5ea62e' },
    { tag: t.attributeValue, color: '#5efaf0' },
    { tag: t.regexp, color: '#f36666' },
    { tag: t.invalid, color: '#f36666' },
  ],
  { all: { color: '#fafafa' } },
);

/**
 * Shell id → language support, the successor to `SHELL_TO_LANGUAGE`.
 *
 * `cmd` maps to nothing on purpose: no bat/cmd/dos mode exists in the official
 * packages or in `@codemirror/legacy-modes`, so a Windows batch script renders
 * unhighlighted. It is the one language monaco coloured and this does not.
 */
function languageFor(shellId: string): Extension {
  switch (shellId.toLowerCase()) {
    case 'powershell':
      return StreamLanguage.define(powerShell);
    case 'python':
      return python();
    case 'sql':
      return sql();
    case 'deno':
      return javascript({ typescript: true });
    case 'cmd':
      return [];
    default:
      // bash, shell, nushell — and anything unrecognised, as before.
      return StreamLanguage.define(shell);
  }
}

/**
 * Marks the doc replacement in the sync effect as OURS.
 *
 * CodeMirror hands programmatic and typed changes to `updateListener` alike, so
 * without a mark on the transaction the editor answers a `value` push by
 * reporting it straight back out as if the user had typed it. `@monaco-editor/react`
 * suppressed the same echo internally (`preventTriggerChangeEvent`), so every
 * caller here was written against an editor that does not do this.
 */
const externalSync = Annotation.define<true>();

type Eol = '\r\n' | '\n';

/**
 * CodeMirror documents hold LF and nothing else — `Text` splits input on
 * `/\r\n?|\n/` and `toString()` always joins with `\n`. Left alone that quietly
 * rewrites the line endings of every Windows-authored script the moment one
 * character is typed: the editor would hand the form a fully LF-converted file
 * as if the user had done it. These three put the ending back on the way out and
 * take it off before comparing, so the document and the bound value can be
 * compared at all (a CRLF value never equals the LF document, so without
 * {@link toDocText} the sync effect would fire on every pass).
 *
 * Only `\r\n` is restored, never a lone `\r`: classic Mac endings are not
 * something any shell here emits, and guessing them back would be worse than
 * normalising. A file with MIXED endings is normalised to whichever its first
 * line break uses, so lines the user never touched do change — unavoidable
 * once the document itself cannot hold the distinction, and it matches what
 * monaco did.
 */
function toDocText(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function fromDocText(text: string, eol: Eol): string {
  return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

/**
 * The ending a value uses, decided by its FIRST line break — what a text editor
 * does when it opens a file, and the only safe rule for a mixed one. Asking
 * `value.includes('\r\n')` instead lets a single stray CRLF anywhere convert the
 * whole script, and converting a bash script to CRLF makes its shebang
 * `#!/bin/bash\r`, which the endpoint rejects as a bad interpreter.
 *
 * `null` when there is no break at all: a one-line script says nothing about the
 * ending its author used, so the caller keeps the one it already had instead of
 * flipping to LF the moment a CRLF file is edited down to a single line.
 */
function eolOf(value: string): Eol | null {
  const match = /\r\n|\n/.exec(value);
  if (!match) return null;
  return match[0] === '\r\n' ? '\r\n' : '\n';
}

/**
 * Read-only: the state rejects edits, the DOM stops accepting them, and BOTH
 * active-line marks go — the band and the brightened line number. Monaco ran
 * `renderLineHighlight: 'none'` when read-only, and a marked line with no caret
 * to explain it reads as a selection the reader did not make. Keep the pair
 * together: splitting them leaves a read-only editor with a white line number
 * over an unhighlighted line, which is neither of the two intended looks.
 */
function editableFor(readOnly: boolean): Extension {
  return readOnly
    ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
    : [highlightActiveLine(), highlightActiveLineGutter()];
}

interface ScriptEditorViewProps {
  value: string;
  onChange?: (value: string) => void;
  shell: string;
  readOnly: boolean;
  /** Fires once the view exists — what lifts the placeholder. */
  onReady: () => void;
}

export default function ScriptEditorView({
  value,
  onChange,
  shell: shellId,
  readOnly,
  onReady,
}: ScriptEditorViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  const languageExt = useMemo(() => languageFor(shellId), [shellId]);
  const editableExt = useMemo(() => editableFor(readOnly), [readOnly]);

  // The view is built once and reconfigured in place, so everything it reads at
  // build time comes through here: a changed `onChange` identity or a `value`
  // that arrived a frame later must not tear the editor down and take the
  // user's cursor, scroll position and undo history with it.
  const latestRef = useRef({ value, onChange, onReady, languageExt, editableExt });
  useEffect(() => {
    latestRef.current = { value, onChange, onReady, languageExt, editableExt };
  });

  // The line ending the bound value arrived with, so edits can be handed back in
  // the same terms. Seeded from the first value and refreshed by every external
  // push, which are the only places an ending is observable.
  const eolRef = useRef<Eol>(eolOf(value) ?? '\n');

  // Lazy `useState` rather than a `ref.current ??=` idiom: these two compartments
  // are READ during render (the effects below list them as dependencies), and a
  // ref read in render is invisible to React. A lazy initializer gives the same
  // create-once, stable-for-the-component's-life value without that.
  const [{ language, editable }] = useState(() => ({
    language: new Compartment(),
    editable: new Compartment(),
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: toDocText(latestRef.current.value),
        extensions: [
          lineNumbers(),
          foldGutter(),
          history(),
          bracketMatching(),
          closeBrackets(),
          search({ top: true }),
          highlightSelectionMatches(),
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          // No `lineWrapping`: monaco ran `wordWrap: 'off'`, so a long line
          // scrolls sideways rather than folding. Adding it is one line, but it
          // is a change to how every script reads, not part of the swap.
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          odsTheme,
          syntaxHighlighting(odsHighlight),
          language.of(latestRef.current.languageExt),
          editable.of(latestRef.current.editableExt),
          EditorView.updateListener.of(update => {
            if (!update.docChanged) return;
            if (update.transactions.some(tr => tr.annotation(externalSync))) return;
            latestRef.current.onChange?.(fromDocText(update.state.doc.toString(), eolRef.current));
          }),
        ],
      }),
    });

    viewRef.current = view;
    latestRef.current.onReady();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Built ONCE — the compartments carry every later change in. `language` and
    // `editable` are the compartment instances, stable for this component's
    // life; listing the props here instead would destroy the editor on a shell
    // change and take the undo history with it.
  }, [language, editable]);

  // A `value` pushed from outside — the query landing, or a form reset. Typing
  // does not reach here: the parent's state already equals the doc by then, and
  // the guard is what stops the round trip from rewriting the doc under the
  // cursor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    const incoming = toDocText(value);
    // ABOVE the equality guard on purpose: a push that changes only the line
    // endings normalises to the same document and returns early, and that push
    // is precisely the one carrying new information about the ending.
    eolRef.current = eolOf(value) ?? eolRef.current;
    if (current === incoming) return;
    const { anchor, head } = view.state.selection.main;
    // Clamped against the CHANGESET's length, never `value.length`: CodeMirror
    // normalises CRLF to LF on the way in, so a script authored on Windows —
    // every PowerShell and cmd one — produces a document shorter than the string
    // that made it, and a selection past the end throws "Selection points
    // outside of document" rather than being clipped.
    const changes = view.state.changes({ from: 0, to: current.length, insert: incoming });
    view.dispatch({
      changes,
      // Replacing the whole document maps every position to 0, so the caret has
      // to be carried across by hand.
      selection: { anchor: Math.min(anchor, changes.newLength), head: Math.min(head, changes.newLength) },
      annotations: [
        externalSync.of(true),
        // NOT an undoable step. The edit pages mount the editor empty and let
        // the record arrive through here, so without this the first Cmd+Z
        // undoes the script itself — emptying the editor and, through
        // `onChange`, writing that empty string into the bound form field.
        Transaction.addToHistory.of(false),
      ],
    });
  }, [value]);

  const isFirstConfigRef = useRef(true);
  useEffect(() => {
    if (isFirstConfigRef.current) {
      isFirstConfigRef.current = false;
      return;
    }
    viewRef.current?.dispatch({
      effects: [language.reconfigure(languageExt), editable.reconfigure(editableExt)],
    });
  }, [language, editable, languageExt, editableExt]);

  return <div ref={hostRef} className="h-full" />;
}
