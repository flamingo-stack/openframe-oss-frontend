/**
 * A paged table's stale-cursor boundary: a cursor the server refuses (the remote sessions' `INVALID_CURSOR`, a cursor
 * issued under another sort or before a release that changed the cursors) drops to the first page with no error
 * screen; every other error, and any error on the first page, goes up to the content boundary unchanged.
 */
import { act, Component, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaleCursorBoundary } from './stale-cursor-boundary';

/** What Relay throws when the server answers a query with errors and no data. */
const REFUSAL = new Error(
  'No data returned for operation `tenantRemoteSessionsRelayQuery`, got error(s):\nINVALID_CURSOR',
);

class Outer extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    return this.state.error ? <p data-outer-error /> : this.props.children;
  }
}

function Throws({ error }: { error: Error }): ReactNode {
  throw error;
}

let container: HTMLDivElement;
let root: Root;

function render(cursor: string | null, error: Error, onStaleCursor: () => void) {
  act(() =>
    root.render(
      <Outer>
        <StaleCursorBoundary cursor={cursor} onStaleCursor={onStaleCursor}>
          <Throws error={error} />
        </StaleCursorBoundary>
      </Outer>,
    ),
  );
}

const outerError = () => container.querySelector('[data-outer-error]');

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // React reports every caught render error on the console.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

describe('StaleCursorBoundary', () => {
  it('drops a refused cursor, with no error screen', () => {
    const onStaleCursor = vi.fn();
    render('cursor-3', REFUSAL, onStaleCursor);

    expect(onStaleCursor).toHaveBeenCalledTimes(1);
    expect(outerError()).toBeNull();
  });

  it('sends any other error up, the cursor kept', () => {
    const onStaleCursor = vi.fn();
    render('cursor-3', new Error('Failed to fetch'), onStaleCursor);

    expect(onStaleCursor).not.toHaveBeenCalled();
    expect(outerError()).not.toBeNull();
  });

  it('sends a refusal on the first page up: there is no cursor to drop', () => {
    const onStaleCursor = vi.fn();
    render(null, REFUSAL, onStaleCursor);

    expect(onStaleCursor).not.toHaveBeenCalled();
    expect(outerError()).not.toBeNull();
  });
  it('renders the first page once the cursor the query reads is gone', () => {
    const onStaleCursor = vi.fn();
    function Page({ cursor }: { cursor: string | null }): ReactNode {
      if (cursor) throw REFUSAL;
      return <p data-first-page />;
    }
    const view = (cursor: string | null) =>
      act(() =>
        root.render(
          <Outer>
            <StaleCursorBoundary cursor={cursor} onStaleCursor={onStaleCursor}>
              <Page cursor={cursor} />
            </StaleCursorBoundary>
          </Outer>,
        ),
      );

    view('cursor-3');
    expect(onStaleCursor).toHaveBeenCalledTimes(1);
    // A re-render still reading the refused cursor stays blank, not an error screen.
    view('cursor-3');
    expect(outerError()).toBeNull();

    view(null);
    expect(container.querySelector('[data-first-page]')).not.toBeNull();
    expect(outerError()).toBeNull();
  });
});
