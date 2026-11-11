/**
 * A Retry works only if every query under it moves off the fetchKey its failure is retained under (Relay keeps a
 * failed read for five minutes). A boundary nested under the one that retried, and one remounted after its own retry,
 * must not go back to that key. And the key a render derives must come out the same every time React runs that render.
 */

import { act, Component, type ReactNode, Suspense, useDeferredValue, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentErrorBoundary, useRetryKey } from './content-error-boundary';

const reads = vi.hoisted(() => ({ header: true, details: true }));

function Probe({ name, fails }: { name: string; fails: keyof typeof reads }) {
  const key = useRetryKey();
  if (!reads[fails]) throw new Error(`${name} failed`);
  return <span data-probe={name}>{key}</span>;
}

/** The keys a read failed under: read again under one, it throws with no request, as Relay's retained rejection does. */
const retained = new Set<number>();

function RetainedProbe() {
  const key = useRetryKey();
  if (retained.has(key)) throw new Error('retained rejection');
  if (!reads.details) {
    retained.add(key);
    throw new Error('details failed');
  }
  return <span data-probe="retained">{key}</span>;
}

let container: HTMLDivElement;
let root: Root;

const keyOf = (name: string) => container.querySelector(`[data-probe="${name}"]`)?.textContent ?? null;
const retry = () =>
  act(() => {
    [...container.querySelectorAll('button')].find(button => /try again/i.test(button.textContent ?? ''))?.click();
  });

describe('ContentErrorBoundary retry keys', () => {
  beforeEach(() => {
    reads.header = true;
    reads.details = true;
    retained.clear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("gives a boundary nested under the one that retried the outer's new key", () => {
    reads.header = false;
    act(() =>
      root.render(
        <ContentErrorBoundary label="Page">
          <Probe name="header" fails="header" />
          <ContentErrorBoundary label="Tab">
            <Probe name="details" fails="details" />
          </ContentErrorBoundary>
        </ContentErrorBoundary>,
      ),
    );
    expect(keyOf('header')).toBeNull();

    reads.header = true;
    retry();
    expect(keyOf('header')).not.toBeNull();
    expect(keyOf('details')).toBe(keyOf('header'));
  });

  it('keeps the key its retry moved to when the boundary is mounted again', () => {
    reads.details = false;
    const tab = (
      <ContentErrorBoundary label="Tab">
        <Probe name="details" fails="details" />
      </ContentErrorBoundary>
    );
    act(() => root.render(tab));
    reads.details = true;
    retry();
    const retried = keyOf('details');
    expect(retried).not.toBeNull();

    act(() => root.render(null));
    act(() => root.render(tab));
    expect(keyOf('details')).toBe(retried);
  });

  it('starts a boundary mounted again after a failure, with no Retry, off the key it failed under', () => {
    reads.details = false;
    const tab = (
      <ContentErrorBoundary label="Tab">
        <RetainedProbe />
      </ContentErrorBoundary>
    );
    act(() => root.render(tab));
    expect(keyOf('retained')).toBeNull();

    reads.details = true;
    act(() => root.render(null));
    act(() => root.render(tab));
    expect(keyOf('retained')).not.toBeNull();
  });

  it("gives a boundary nested under one its resetKey cleared the outer's new key", () => {
    reads.header = false;
    const page = (resetKey: string) => (
      <ContentErrorBoundary label="Page" resetKey={resetKey}>
        <Probe name="header" fails="header" />
        <ContentErrorBoundary label="Tab">
          <Probe name="details" fails="details" />
        </ContentErrorBoundary>
      </ContentErrorBoundary>
    );
    act(() => root.render(page('a')));
    expect(keyOf('header')).toBeNull();

    reads.header = true;
    act(() => root.render(page('b')));
    expect(keyOf('header')).not.toBeNull();
    expect(keyOf('details')).toBe(keyOf('header'));
  });

  it('derives the same key each time React runs the recovering render', () => {
    const failed = { failed: true, error: new Error('read failed'), resetKey: 'a', retryKey: 3 };
    const props = { children: null, resetKey: 'b' };

    const first = ContentErrorBoundary.getDerivedStateFromProps(props, failed);
    const again = ContentErrorBoundary.getDerivedStateFromProps(props, failed);
    expect(first?.retryKey).toBeGreaterThan(3);
    expect(again?.retryKey).toBe(first?.retryKey);
  });
});

/**
 * A caller whose own state follows the failure (a pick the failed list no longer shows) hears of it in the commit that
 * shows the fallback, so the fallback is never painted beside the stale state. Next's `notFound()` is not a failure.
 */
describe('ContentErrorBoundary onError', () => {
  class Above extends Component<{ children: ReactNode }, { caught: boolean }> {
    state = { caught: false };
    static getDerivedStateFromError() {
      return { caught: true };
    }
    render() {
      return this.state.caught ? <span data-probe="above" /> : this.props.children;
    }
  }

  function NotFound(): never {
    throw Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  }

  let host: HTMLDivElement;
  let hostRoot: Root;

  beforeEach(() => {
    reads.details = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    host = document.createElement('div');
    document.body.appendChild(host);
    hostRoot = createRoot(host);
  });

  afterEach(() => {
    act(() => hostRoot.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('reports what it caught, once', () => {
    reads.details = false;
    const onError = vi.fn();
    act(() =>
      hostRoot.render(
        <ContentErrorBoundary onError={onError}>
          <Probe name="details" fails="details" />
        </ContentErrorBoundary>,
      ),
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(new Error('details failed'));
  });

  it('leaves notFound() to the boundary above without reporting it', () => {
    const onError = vi.fn();
    act(() =>
      hostRoot.render(
        <Above>
          <ContentErrorBoundary onError={onError}>
            <NotFound />
          </ContentErrorBoundary>
        </Above>,
      ),
    );
    expect(host.querySelector('[data-probe="above"]')).not.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("puts the caller's update on screen in the same task as the fallback", async () => {
    const control = { fail: () => undefined as void };

    function Rows({ fails }: { fails: boolean }) {
      if (fails) throw new Error('rows failed');
      return null;
    }

    function Panel() {
      const [fails, setFails] = useState(false);
      const [picked, setPicked] = useState(true);
      useEffect(() => {
        control.fail = () => setFails(true);
      }, []);
      const deferred = useDeferredValue(fails);
      return (
        <>
          <button type="button" disabled={!picked}>
            Link
          </button>
          <ContentErrorBoundary onError={() => setPicked(false)} fallback={() => <span data-failed />}>
            <Rows fails={deferred} />
          </ContentErrorBoundary>
        </>
      );
    }

    act(() => hostRoot.render(<Panel />));
    // What a paint between two tasks would show. Real tasks and no act: act runs them all at once and hides the gap.
    const painted: boolean[] = [];
    const observer = new MutationObserver(() => {
      if (host.querySelector('[data-failed]')) painted.push(host.querySelector('button')?.disabled ?? false);
    });
    observer.observe(host, { subtree: true, childList: true, attributes: true });
    const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      control.fail();
      await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
      observer.disconnect();
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
    }
    expect(painted).not.toEqual([]);
    expect(painted).not.toContain(false);
  });
});

/**
 * A resetKey that changes in a deferred render: the read under the boundary suspends, nothing is committed, and React
 * runs the render again once it answers. A key that moved on that second run was a new request, and so on forever.
 */
describe('ContentErrorBoundary under a deferred resetKey', () => {
  const control = { setFilter: (_: string) => undefined as void };
  const requested: string[] = [];
  const answers = new Map<string, Error | Promise<void>>();

  /** A read that fails, kept failed under its key as Relay keeps one. */
  function read(key: string) {
    const known = answers.get(key);
    if (known) throw known;
    requested.push(key);
    const pending = new Promise<void>(resolve =>
      setTimeout(() => {
        answers.set(key, new Error(`${key} failed`));
        resolve();
      }, 5),
    );
    answers.set(key, pending);
    throw pending;
  }

  function Rows({ filter }: { filter: string }) {
    read(`${filter}-${useRetryKey()}`);
    return null;
  }

  function Panel() {
    const [filter, setFilter] = useState('a');
    useEffect(() => {
      control.setFilter = setFilter;
    }, []);
    const deferred = useDeferredValue(filter);
    return (
      <ContentErrorBoundary resetKey={deferred} fallback={() => <span data-failed>{deferred}</span>}>
        <Rows filter={deferred} />
      </ContentErrorBoundary>
    );
  }

  const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

  it('settles on the new filter instead of asking again on every run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Real timers and no act: what is under test is React restarting a render that suspended.
    const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const panelRoot = createRoot(host);
    try {
      panelRoot.render(
        <Suspense fallback={null}>
          <Panel />
        </Suspense>,
      );
      // React holds a revealed fallback for its throttle (300ms) before committing what follows.
      await settle(1000);
      expect(host.querySelector('[data-failed]')?.textContent).toBe('a');

      const before = requested.length;
      control.setFilter('b');
      await settle(1500);
      expect(host.querySelector('[data-failed]')?.textContent).toBe('b');
      expect(requested.length - before).toBeLessThanOrEqual(2);
    } finally {
      panelRoot.unmount();
      host.remove();
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
      vi.restoreAllMocks();
    }
  });
});
