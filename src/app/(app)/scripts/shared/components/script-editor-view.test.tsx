/**
 * Pins the seam between the bound `value` and the CodeMirror document.
 *
 * The editor is a controlled component wrapped around a library that owns its
 * own document, history and selection, so a value arriving from outside has to
 * be told apart from something the user typed. It is not, by default: CodeMirror
 * hands programmatic and typed changes to the same listener, records both in the
 * undo stack, and maps every position through a whole-document replacement. Each
 * test below stands on one of those, and the edit pages are why they matter —
 * they mount the editor empty and let the script arrive a moment later, so the
 * arrival is the change most likely to be mistaken for an edit.
 *
 * The line-ending tests are the other half: CodeMirror documents hold LF only,
 * and these scripts are shipped to Windows endpoints.
 */

import { undo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ScriptEditorView from './script-editor-view';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const view = () => {
  const found = EditorView.findFromDOM(container);
  if (!found) throw new Error('no EditorView in the container');
  return found;
};

const runUndo = () =>
  act(() => {
    undo({ state: view().state, dispatch: t => view().dispatch(t) });
  });

function render(props: { value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  act(() => {
    root.render(
      <ScriptEditorView
        value={props.value}
        onChange={props.onChange}
        shell="bash"
        readOnly={props.readOnly ?? false}
        onReady={() => {}}
      />,
    );
  });
}

describe('ScriptEditorView', () => {
  it('does not let undo wipe a script that arrived from outside', () => {
    const seen: string[] = [];
    render({ value: '', onChange: v => seen.push(v) });
    render({ value: '#!/bin/bash\necho hi', onChange: v => seen.push(v) });
    expect(view().state.doc.toString()).toBe('#!/bin/bash\necho hi');

    runUndo();

    // Both halves of the bug: the undo must not empty the document, and it must
    // not report that emptying back into the bound form field.
    expect(view().state.doc.toString()).toBe('#!/bin/bash\necho hi');
    expect(seen).toEqual([]);
  });

  it('does not echo an external push back through onChange', () => {
    const seen: string[] = [];
    render({ value: 'a', onChange: v => seen.push(v) });
    render({ value: 'pushed from the parent', onChange: v => seen.push(v) });
    expect(seen).toEqual([]);
  });

  it('still reports a real user edit through onChange', () => {
    const seen: string[] = [];
    render({ value: 'a', onChange: v => seen.push(v) });
    act(() => {
      view().dispatch({ changes: { from: 1, insert: 'b' } });
    });
    expect(seen).toEqual(['ab']);
  });

  it("still undoes the user's own edits", () => {
    render({ value: 'a' });
    act(() => {
      view().dispatch({ changes: { from: 1, insert: 'bc' } });
    });
    expect(view().state.doc.toString()).toBe('abc');

    runUndo();
    expect(view().state.doc.toString()).toBe('a');
  });

  it('keeps the caret across an external push instead of collapsing it to 0', () => {
    render({ value: 'hello world' });
    act(() => {
      view().dispatch({ selection: { anchor: 7 } });
    });
    expect(view().state.selection.main.anchor).toBe(7);

    render({ value: 'hello there world' });
    expect(view().state.selection.main.anchor).toBe(7);
  });

  it('clamps the caret when the arriving value is shorter', () => {
    render({ value: 'hello world' });
    act(() => {
      view().dispatch({ selection: { anchor: 11 } });
    });

    render({ value: 'hi' });
    expect(view().state.doc.toString()).toBe('hi');
    expect(view().state.selection.main.anchor).toBe(2);
  });

  it('drops both active-line marks when read-only and restores them when editable', () => {
    render({ value: 'x', readOnly: true });
    expect(container.querySelector('.cm-activeLine')).toBeNull();
    expect(container.querySelector('.cm-activeLineGutter')).toBeNull();
    // The rail itself must survive: both marks left the base extension list, and
    // only `lineNumbers()` still puts numbers there.
    expect(container.querySelector('.cm-lineNumbers')).not.toBeNull();

    render({ value: 'x', readOnly: false });
    expect(container.querySelector('.cm-activeLine')).not.toBeNull();
    expect(container.querySelector('.cm-activeLineGutter')).not.toBeNull();
  });

  // CodeMirror normalises CRLF to LF, so a Windows-authored script yields a
  // document SHORTER than the string that made it; clamping the carried caret to
  // the string's length rather than the document's throws.
  it('takes a CRLF script with the caret at the end without throwing', () => {
    render({ value: 'a'.repeat(40) });
    act(() => {
      view().dispatch({ selection: { anchor: 40 } });
    });

    render({ value: 'line one\r\nline two\r\nline three' });
    expect(view().state.doc.toString()).toBe('line one\nline two\nline three');
    expect(view().state.selection.main.anchor).toBe(view().state.doc.length);
  });

  it('hands a CRLF script back with its line endings intact', () => {
    const seen: string[] = [];
    render({ value: 'Write-Host one\r\nWrite-Host two', onChange: v => seen.push(v) });
    act(() => {
      view().dispatch({ changes: { from: view().state.doc.length, insert: '!' } });
    });
    // One typed character must not convert the whole file's line endings.
    expect(seen).toEqual(['Write-Host one\r\nWrite-Host two!']);
  });

  it('leaves an LF script on LF', () => {
    const seen: string[] = [];
    render({ value: 'echo one\necho two', onChange: v => seen.push(v) });
    act(() => {
      view().dispatch({ changes: { from: view().state.doc.length, insert: '!' } });
    });
    expect(seen).toEqual(['echo one\necho two!']);
  });

  it('adopts the ending of a value pushed in after mount', () => {
    // The seed only sees the FIRST value, so mounting on LF and pushing CRLF is
    // the one path that exercises the refresh in the sync effect.
    const seen: string[] = [];
    render({ value: 'echo one\necho two', onChange: v => seen.push(v) });

    render({ value: 'Write-Host one\r\nWrite-Host two', onChange: v => seen.push(v) });
    act(() => {
      view().dispatch({ changes: { from: view().state.doc.length, insert: '!' } });
    });
    expect(seen).toEqual(['Write-Host one\r\nWrite-Host two!']);
  });

  it('keeps the dominant ending of a mixed file rather than the stray one', () => {
    // One stray CRLF must not convert the whole script: a bash file handed back
    // as CRLF has `#!/bin/bash\r` for a shebang, which the endpoint rejects.
    const seen: string[] = [];
    render({ value: '#!/bin/bash\nsetup\r\necho hi', onChange: v => seen.push(v) });
    act(() => {
      view().dispatch({ changes: { from: view().state.doc.length, insert: '!' } });
    });
    expect(seen).toEqual(['#!/bin/bash\nsetup\necho hi!']);
  });

  it('does not report a selection-only change through onChange', () => {
    const seen: string[] = [];
    render({ value: 'echo one\necho two', onChange: v => seen.push(v) });
    act(() => {
      view().dispatch({ selection: { anchor: 4 } });
    });
    // Moving the caret must not dirty the bound form field.
    expect(seen).toEqual([]);
  });

  it('keeps undo history when a CRLF value round-trips through the parent', () => {
    // The document is LF while the bound value is CRLF, so comparing them
    // without normalising is PERMANENTLY unequal: every keystroke's round trip
    // would come back as a whole-document replace, and each replace maps the
    // stored undo events onto an empty document and drops them. The observable
    // consequence is that the user's own edit stops being undoable.
    const seen: string[] = [];
    render({ value: 'one\r\ntwo', onChange: v => seen.push(v) });

    act(() => {
      view().dispatch({ changes: { from: view().state.doc.length, insert: '!' } });
    });
    expect(seen).toEqual(['one\r\ntwo!']);

    render({ value: seen[0], onChange: v => seen.push(v) });

    runUndo();
    expect(view().state.doc.toString()).toBe('one\ntwo');
  });
});
