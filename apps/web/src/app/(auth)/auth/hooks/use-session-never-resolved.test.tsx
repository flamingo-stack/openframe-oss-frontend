// Pins when the shell gives up on the first session check and shows the session screen instead of its skeletons
// (CU-17tkuw69v8q): only once `/me` has gone unanswered for the fail-open window, never while it is paused offline,
// and no longer the moment it answers.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionNeverResolved } from './use-session-never-resolved';

const { session } = vi.hoisted(() => ({ session: { isReady: false, isPaused: false } }));

vi.mock('./use-auth-session', () => ({ useAuthSession: () => session }));

let container: HTMLDivElement;
let root: Root;
let warn: ReturnType<typeof vi.spyOn>;

function Probe() {
  return <p data-stuck={String(useSessionNeverResolved())} />;
}

const stuck = () => container.querySelector('p')?.getAttribute('data-stuck');
const render = () => act(() => root.render(<Probe />));

beforeEach(() => {
  vi.useFakeTimers();
  session.isReady = false;
  session.isPaused = false;
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  warn.mockRestore();
  vi.useRealTimers();
});

describe('useSessionNeverResolved', () => {
  it('waits out the fail-open window, then reports the session as never resolved, once', () => {
    render();
    act(() => vi.advanceTimersByTime(9_999));
    expect(stuck()).toBe('false');
    act(() => vi.advanceTimersByTime(1));
    expect(stuck()).toBe('true');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('lets go the moment /me answers', () => {
    render();
    act(() => vi.advanceTimersByTime(10_000));
    expect(stuck()).toBe('true');
    session.isReady = true;
    render();
    expect(stuck()).toBe('false');
  });

  it('never reports a check paused offline', () => {
    session.isPaused = true;
    render();
    act(() => vi.advanceTimersByTime(60_000));
    expect(stuck()).toBe('false');
    expect(warn).not.toHaveBeenCalled();
  });

  it('never reports an answered session, and warns about nothing on a healthy load', () => {
    session.isReady = true;
    render();
    act(() => vi.advanceTimersByTime(60_000));
    expect(stuck()).toBe('false');
    expect(warn).not.toHaveBeenCalled();
  });
});
